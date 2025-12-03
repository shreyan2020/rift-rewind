import { motion } from 'framer-motion';
import { useState, useMemo } from 'react';
import type { Quarter, Finale } from '../api';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface PlayerJourney {
  riotId: string;
  quarters: Record<string, Quarter>;
  finale?: Finale;
  metadata?: {
    playerName?: string;
    archetype?: string;
    totalGames?: number;
  };
}

interface FriendComparisonProps {
  onBack: () => void;
}

const FriendComparison: React.FC<FriendComparisonProps> = ({ onBack }) => {
  const [player1Data, setPlayer1Data] = useState<PlayerJourney | null>(null);
  const [player2Data, setPlayer2Data] = useState<PlayerJourney | null>(null);
  const [comparisonLore, setComparisonLore] = useState<string>('');
  const [relationshipType, setRelationshipType] = useState<'allies' | 'rivals' | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);

  const API_BASE_URL =
    (import.meta as any).env?.VITE_API_BASE_URL ??
    (window as any).__API_BASE_URL ??
    'https://prbztxv7p9.execute-api.eu-west-1.amazonaws.com';

  // Normalize Q*.top_values -> string[]
  function getTopValueNames(quarters: Record<string, Quarter>): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const q of Object.values(quarters)) {
      const tops = q.top_values ?? [];
      for (const t of tops) {
        const name = typeof t === 'string' ? t : t?.[0];
        if (name && !seen.has(name)) {
          seen.add(name);
          out.push(name);
        }
      }
    }
    return out.slice(0, 5);
  }

  const handleFileUpload = (file: File, playerNum: 1 | 2) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        const playerData: PlayerJourney = {
          riotId: json.metadata?.playerName || json.riotId || `Player ${playerNum}`,
          quarters: json.quarters || {},
          finale: json.finale,
          metadata: json.metadata
        };
        if (playerNum === 1) setPlayer1Data(playerData);
        else setPlayer2Data(playerData);
        setError('');
      } catch {
        setError(`Failed to parse Player ${playerNum}'s file. Please upload a valid journey JSON.`);
      }
    };
    reader.readAsText(file);
  };

  // Calculate similarity between two players
  const calculateSimilarity = useMemo(() => {
    if (!player1Data || !player2Data) return null;

    const getAvgValues = (quarters: Record<string, Quarter>) => {
      const allValues: Record<string, number[]> = {};
      Object.values(quarters).forEach(q => {
        Object.entries(q.values || {}).forEach(([name, value]) => {
          if (!allValues[name]) allValues[name] = [];
          allValues[name].push((value as number) ?? 0);
        });
      });
      const avgValues: Record<string, number> = {};
      Object.entries(allValues).forEach(([name, values]) => {
        const n = values.length || 0;
        avgValues[name] = n ? values.reduce((a, b) => a + b, 0) / n : 0;
      });
      return avgValues;
    };

    const p1Values = getAvgValues(player1Data.quarters);
    const p2Values = getAvgValues(player2Data.quarters);

    const commonValues = Object.keys(p1Values).filter(k => k in p2Values);
    if (commonValues.length === 0) return { score: 0, type: 'rivals' as const };

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    commonValues.forEach(key => {
      dotProduct += p1Values[key] * p2Values[key];
      mag1 += p1Values[key] ** 2;
      mag2 += p2Values[key] ** 2;
    });

    const denom = Math.sqrt(mag1) * Math.sqrt(mag2) || 1;
    const similarity = dotProduct / denom;

    return {
      score: similarity,
      type: similarity > 0.7 ? 'allies' as const : 'rivals' as const,
      topSharedValues: commonValues
        .map(k => ({ name: k, diff: Math.abs(p1Values[k] - p2Values[k]), p1: p1Values[k], p2: p2Values[k] }))
        .filter(v => !(v.p1 === 0 && v.p2 === 0))
        .sort((a, b) => a.diff - b.diff)
        .slice(0, 3)
        .map(v => ({ name: v.name, p1: v.p1, p2: v.p2 })),
      topConflictingValues: commonValues
        .map(k => ({ name: k, diff: Math.abs(p1Values[k] - p2Values[k]), p1: p1Values[k], p2: p2Values[k] }))
        .filter(v => !(v.p1 === 0 && v.p2 === 0))
        .sort((a, b) => b.diff - a.diff)
        .slice(0, 3)
        .map(v => ({ name: v.name, p1: v.p1, p2: v.p2 }))
    };
  }, [player1Data, player2Data]);

  const generateComparisonLore = async () => {
    if (!player1Data || !player2Data || !calculateSimilarity) return;

    setIsGenerating(true);
    setError('');
    try {
      const relationship = calculateSimilarity.type;
      setRelationshipType(relationship);

      const comparisonData = {
        player1: {
          name: player1Data.riotId,
          totalGames: player1Data.finale?.year_summary?.total_games || 0,
          topValues: getTopValueNames(player1Data.quarters),
          topChampion:
            player1Data.finale?.champion_analysis?.top_champions?.[0]?.name ||
            'Unknown',
        },
        player2: {
          name: player2Data.riotId,
          totalGames: player2Data.finale?.year_summary?.total_games || 0,
          topValues: getTopValueNames(player2Data.quarters),
          topChampion:
            player2Data.finale?.champion_analysis?.top_champions?.[0]?.name ||
            'Unknown',
        },
        relationship,
        sharedValues: (calculateSimilarity.topSharedValues || []).map(v => ({ name: v.name })),
        conflictingValues: (calculateSimilarity.topConflictingValues || []).map(v => ({ name: v.name })),
        similarityScore: calculateSimilarity.score,
      };

      const { data } = await axios.post(
        `${API_BASE_URL}/journey/compare`,
        comparisonData,
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (!data?.lore) throw new Error('No lore returned');
      setComparisonLore(data.lore);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.error ??
        err?.message ??
        'Failed to generate lore'
      );
      generateFallbackLore();
    } finally {
      setIsGenerating(false);
    }
  };

  const generateFallbackLore = () => {
  if (!player1Data || !player2Data || !calculateSimilarity) return;

  const p1Name = player1Data.riotId.split('#')[0];
  const p2Name = player2Data.riotId.split('#')[0];
  const relationship = calculateSimilarity.type;

  if (relationship === 'allies') {
    setComparisonLore(
      `In the mystical lands of Runeterra, two champions emerged... ${p1Name} and ${p2Name} became legendary allies.`
    );
  } else {
    setComparisonLore(
      `Two titans rose from opposite ends of Runeterra... ${p1Name} and ${p2Name} forged a legendary rivalry.`
    );
  }
  setRelationshipType(relationship);
};


  // Stats comparison
  const statsComparison = useMemo(() => {
    if (!player1Data || !player2Data) return null;

    const getAvgStat = (quarters: Record<string, Quarter>, stat: keyof Quarter['stats']) => {
      const arr = Object.values(quarters).map(q => q.stats?.[stat] ?? 0);
      const n = arr.length || 0;
      return n ? arr.reduce((a, b) => a + b, 0) / n : 0;
    };

    return {
      kda: {
        p1: getAvgStat(player1Data.quarters, 'kda_proxy'),
        p2: getAvgStat(player2Data.quarters, 'kda_proxy')
      },
      cs: {
        p1: getAvgStat(player1Data.quarters, 'cs_per_min'),
        p2: getAvgStat(player2Data.quarters, 'cs_per_min')
      },
      gold: {
        p1: getAvgStat(player1Data.quarters, 'gold_per_min'),
        p2: getAvgStat(player2Data.quarters, 'gold_per_min')
      },
      vision: {
        p1: getAvgStat(player1Data.quarters, 'vision_score_per_min') * 30,
        p2: getAvgStat(player2Data.quarters, 'vision_score_per_min') * 30
      }
    };
  }, [player1Data, player2Data]);

  // Get all unique value names for dropdown
  const allValueNames = useMemo(() => {
    if (!player1Data || !player2Data) return [];
    const valueSet = new Set<string>();
    Object.values(player1Data.quarters).forEach(q => {
      Object.keys(q.values || {}).forEach(key => valueSet.add(key));
    });
    Object.values(player2Data.quarters).forEach(q => {
      Object.keys(q.values || {}).forEach(key => valueSet.add(key));
    });
    return Array.from(valueSet).sort();
  }, [player1Data, player2Data]);

  return (
    <div className={`min-h-screen ${comparisonLore ? 'p-2 md:p-4' : 'p-4 md:p-8'}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={comparisonLore ? "w-full px-2" : "w-full max-w-7xl mx-auto"}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-5xl font-bold text-runeterra-gold mb-3 animate-glow">
              Friend Comparison
            </h1>
            <p className="text-runeterra-gold-light text-lg">Upload two journey files to discover if you're allies or rivals.</p>
          </div>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-gradient-to-r from-runeterra-gold to-runeterra-gold-light text-runeterra-darker hover:shadow-lg hover:shadow-runeterra-gold/50 rounded-lg font-bold transition-all"
          >
            ← Back
          </button>
        </div>

        {/* File Upload Section */}
        {!comparisonLore && (
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Player 1 */}
            <div className="bg-gradient-to-br from-runeterra-dark/70 to-runeterra-darker/70 backdrop-blur-sm border-2 border-runeterra-gold/30 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-runeterra-gold mb-4">Player 1</h3>
              {!player1Data ? (
                <label className="block">
                  <div className="border-2 border-dashed border-runeterra-gold/30 rounded-xl p-8 text-center cursor-pointer hover:border-runeterra-gold/50 transition-colors">
                    <div className="text-4xl mb-2">📤</div>
                    <div className="text-runeterra-gold-light mb-2">Click to upload journey JSON</div>
                    <div className="text-sm text-gray-400">Player 1's journey data</div>
                  </div>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 1)}
                  />
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="bg-runeterra-gold/10 border border-runeterra-gold/20 rounded-lg p-4">
                    <div className="text-2xl font-bold text-runeterra-gold">{player1Data.riotId}</div>
                    <div className="text-sm text-runeterra-gold-light mt-1">
                      {player1Data.finale?.year_summary?.total_games || 0} games • 
                      {player1Data.finale?.year_summary?.total_unique_champions || 0} champions
                    </div>
                  </div>
                  <button
                    onClick={() => setPlayer1Data(null)}
                    className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Player 2 */}
            <div className="bg-gradient-to-br from-runeterra-dark/70 to-runeterra-darker/70 backdrop-blur-sm border-2 border-runeterra-gold/30 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-runeterra-gold mb-4">Player 2</h3>
              {!player2Data ? (
                <label className="block">
                  <div className="border-2 border-dashed border-runeterra-gold/30 rounded-xl p-8 text-center cursor-pointer hover:border-runeterra-gold/50 transition-colors">
                    <div className="text-4xl mb-2">📤</div>
                    <div className="text-runeterra-gold-light mb-2">Click to upload journey JSON</div>
                    <div className="text-sm text-gray-400">Player 2's journey data</div>
                  </div>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 2)}
                  />
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="bg-runeterra-gold/10 border border-runeterra-gold/20 rounded-lg p-4">
                    <div className="text-2xl font-bold text-runeterra-gold">{player2Data.riotId}</div>
                    <div className="text-sm text-runeterra-gold-light mt-1">
                      {player2Data.finale?.year_summary?.total_games || 0} games • 
                      {player2Data.finale?.year_summary?.total_unique_champions || 0} champions
                    </div>
                  </div>
                  <button
                    onClick={() => setPlayer2Data(null)}
                    className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generate Button */}
        {player1Data && player2Data && !comparisonLore && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mb-8 no-print">
            <button
              onClick={generateComparisonLore}
              disabled={isGenerating}
              className="px-12 py-4 bg-gradient-to-r from-runeterra-gold to-runeterra-gold-light text-runeterra-darker hover:shadow-lg hover:shadow-runeterra-gold/50 disabled:from-gray-600 disabled:to-gray-600 disabled:text-gray-300 font-bold text-xl rounded-xl transition-all"
            >
              {isGenerating ? '⚡ Generating Your Story...' : '✨ Generate Comparison Story'}
            </button>
          </motion.div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 rounded-lg p-4 mb-8">
            {error}
          </div>
        )}

        {/* Comparison Results */}
        {comparisonLore && relationshipType && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            {/* Relationship Banner */}
            <div className={`text-center p-8 rounded-2xl border-2 ${
              relationshipType === 'allies' 
                ? 'bg-gradient-to-r from-green-900/40 to-blue-900/40 border-green-500/50' 
                : 'bg-gradient-to-r from-red-900/40 to-orange-900/40 border-red-500/50'
            }`}>
              <div className="text-6xl mb-4">
                {relationshipType === 'allies' ? '🤝' : '⚔️'}
              </div>
              <h2 className="text-4xl font-bold mb-2">
                {relationshipType === 'allies' ? 'Legendary Allies' : 'Arch-Nemeses'}
              </h2>
              <p className="text-xl text-gray-300">
                {relationshipType === 'allies' 
                  ? 'Your playstyles complement each other perfectly!' 
                  : 'Your contrasting styles create an epic rivalry!'}
              </p>
              {calculateSimilarity && (
                <div className="mt-4 text-gray-400">
                  Similarity Score: {(calculateSimilarity.score * 100).toFixed(1)}%
                </div>
              )}
            </div>

            {/* The Epic Lore */}
            <div className="bg-gradient-to-br from-runeterra-dark/70 to-runeterra-darker/70 backdrop-blur-sm border-2 border-runeterra-gold/50 rounded-xl p-12 shadow-2xl shadow-runeterra-gold/20">
              <div className="flex items-center justify-center mb-6">
                <div className="h-px bg-runeterra-gold/30 flex-1"></div>
                <h3 className="text-3xl font-bold text-runeterra-gold px-6">
                  ⚔️ The Legend of {player1Data?.riotId} & {player2Data?.riotId}
                </h3>
                <div className="h-px bg-runeterra-gold/30 flex-1"></div>
              </div>
              <div className="prose prose-invert max-w-none">
                {comparisonLore.split('\n\n').map((paragraph, idx) => (
                  <p key={idx} className="text-runeterra-gold-light leading-relaxed mb-4 text-lg">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>

            {/* Stats Comparison */}
            {statsComparison && (
              <div className="bg-runeterra-dark/50 backdrop-blur-sm border border-runeterra-gold/30 rounded-lg p-8">
                <h3 className="text-2xl font-bold text-center mb-6 text-runeterra-gold">📊 Head-to-Head Comparison</h3>
                <div className="grid grid-cols-2 gap-6">
                  {/* KDA */}
                  <div className="text-center">
                    <div className="text-sm text-runeterra-gold-light mb-2">Average KDA</div>
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="text-4xl font-bold text-runeterra-gold">{statsComparison.kda.p1.toFixed(2)}</div>
                        <div className="text-xs text-gray-400">{player1Data?.riotId}</div>
                      </div>
                      <div className="text-2xl text-runeterra-gold-light mx-4">vs</div>
                      <div className="flex-1">
                        <div className="text-4xl font-bold text-runeterra-gold">{statsComparison.kda.p2.toFixed(2)}</div>
                        <div className="text-xs text-gray-400">{player2Data?.riotId}</div>
                      </div>
                    </div>
                  </div>

                  {/* CS/min */}
                  <div className="text-center">
                    <div className="text-sm text-runeterra-gold-light mb-2">Average CS/min</div>
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="text-4xl font-bold text-runeterra-gold">{statsComparison.cs.p1.toFixed(1)}</div>
                        <div className="text-xs text-gray-400">{player1Data?.riotId}</div>
                      </div>
                      <div className="text-2xl text-runeterra-gold-light mx-4">vs</div>
                      <div className="flex-1">
                        <div className="text-4xl font-bold text-runeterra-gold">{statsComparison.cs.p2.toFixed(1)}</div>
                        <div className="text-xs text-gray-400">{player2Data?.riotId}</div>
                      </div>
                    </div>
                  </div>

                  {/* Gold/min */}
                  <div className="text-center">
                    <div className="text-sm text-runeterra-gold-light mb-2">Average Gold/min</div>
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="text-4xl font-bold text-runeterra-gold">{statsComparison.gold.p1.toFixed(0)}</div>
                        <div className="text-xs text-gray-400">{player1Data?.riotId}</div>
                      </div>
                      <div className="text-2xl text-runeterra-gold-light mx-4">vs</div>
                      <div className="flex-1">
                        <div className="text-4xl font-bold text-runeterra-gold">{statsComparison.gold.p2.toFixed(0)}</div>
                        <div className="text-xs text-gray-400">{player2Data?.riotId}</div>
                      </div>
                    </div>
                  </div>

                  {/* Vision */}
                  <div className="text-center">
                    <div className="text-sm text-runeterra-gold-light mb-2">Average Vision Score</div>
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="text-4xl font-bold text-runeterra-gold">{statsComparison.vision.p1.toFixed(0)}</div>
                        <div className="text-xs text-gray-400">{player1Data?.riotId}</div>
                      </div>
                      <div className="text-2xl text-runeterra-gold-light mx-4">vs</div>
                      <div className="flex-1">
                        <div className="text-4xl font-bold text-runeterra-gold">{statsComparison.vision.p2.toFixed(0)}</div>
                        <div className="text-xs text-gray-400">{player2Data?.riotId}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Trajectory Comparison */}
            <div className="bg-runeterra-dark/50 backdrop-blur-sm border border-runeterra-gold/30 rounded-lg p-8">
              <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                <div>
                  <h3 className="text-2xl font-bold text-runeterra-gold flex items-center gap-3">
                    <span className="text-3xl">📊</span>
                    Stats Trajectory
                  </h3>
                  <p className="text-runeterra-gold-light text-xs mt-1 ml-11">Each player's matches divided into 4 equal periods</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-runeterra-gold-light text-sm font-medium">Select Stat:</label>
                  <select
                    value={selectedStat || ''}
                    onChange={(e) => setSelectedStat(e.target.value)}
                    className="px-4 py-2 rounded-lg bg-zinc-800 border border-runeterra-gold/30 text-zinc-100 text-sm focus:outline-none focus:border-runeterra-gold transition-colors"
                  >
                    <option value="" className="bg-zinc-800 text-zinc-100">Choose a stat...</option>
                    <option value="kda_proxy" className="bg-zinc-800 text-zinc-100">KDA</option>
                    <option value="cs_per_min" className="bg-zinc-800 text-zinc-100">CS/min</option>
                    <option value="gold_per_min" className="bg-zinc-800 text-zinc-100">Gold/min</option>
                    <option value="vision_score_per_min" className="bg-zinc-800 text-zinc-100">Vision/min</option>
                  </select>
                </div>
              </div>
              {selectedStat ? (
                <ComparisonStatsChart selectedStat={selectedStat} player1Data={player1Data} player2Data={player2Data} />
              ) : (
                <div className="text-center text-runeterra-gold-light/50 py-16">Select a stat to compare trajectories</div>
              )}
            </div>

            {/* Value Trajectory Comparison */}
            <div className="bg-runeterra-dark/50 backdrop-blur-sm border border-runeterra-gold/30 rounded-lg p-8">
              <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                <div>
                  <h3 className="text-2xl font-bold text-runeterra-gold flex items-center gap-3">
                    <span className="text-3xl">📈</span>
                    Value Trajectory
                  </h3>
                  <p className="text-runeterra-gold-light text-xs mt-1 ml-11">Each player's matches divided into 4 equal periods</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-runeterra-gold-light text-sm font-medium">Select Value:</label>
                  <select
                    value={selectedValue || ''}
                    onChange={(e) => setSelectedValue(e.target.value)}
                    className="px-4 py-2 rounded-lg bg-zinc-800 border border-runeterra-gold/30 text-zinc-100 text-sm focus:outline-none focus:border-runeterra-gold transition-colors"
                  >
                    <option value="" className="bg-zinc-800 text-zinc-100">Choose a value...</option>
                    {allValueNames.map(valueName => (
                      <option key={valueName} value={valueName} className="bg-zinc-800 text-zinc-100">
                        {valueName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {selectedValue ? (
                <ComparisonTimelineChart selectedValue={selectedValue} player1Data={player1Data} player2Data={player2Data} />
              ) : (
                <div className="text-center text-runeterra-gold-light/50 py-16">Select a value to compare trajectories</div>
              )}
            </div>

            {/* Individual Value Comparison */}
            {calculateSimilarity && (
              <div className="bg-runeterra-dark/50 backdrop-blur-sm border border-runeterra-gold/30 rounded-lg p-8">
                <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                  <div>
                    <h3 className="text-2xl font-bold text-runeterra-gold flex items-center gap-3">
                      <span className="text-3xl">📊</span>
                      Individual Value Comparison
                    </h3>
                    <p className="text-runeterra-gold-light text-sm mt-2 ml-11">Compare a specific Schwartz value between both players</p>
                    <p className="text-gray-400 text-xs mt-1 ml-11 italic">Raw scores: Higher = stronger expression.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-runeterra-gold-light text-sm font-medium">Select Value:</label>
                    <select
                      value={selectedValue || ''}
                      onChange={(e) => setSelectedValue(e.target.value)}
                      className="px-4 py-2 rounded-lg bg-zinc-800 border border-runeterra-gold/30 text-zinc-100 text-sm focus:outline-none focus:border-runeterra-gold transition-colors"
                    >
                      <option value="" className="bg-zinc-800 text-zinc-100">Choose a value...</option>
                      {allValueNames.map(valueName => (
                        <option key={valueName} value={valueName} className="bg-zinc-800 text-zinc-100">
                          {valueName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {selectedValue ? (
                  <SingleValueComparisonChart selectedValue={selectedValue} player1Data={player1Data} player2Data={player2Data} />
                ) : (
                  <div className="text-center text-runeterra-gold-light/50 py-16">Select a value to compare</div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => { setComparisonLore(''); setRelationshipType(null); }}
                className="px-8 py-3 bg-gradient-to-r from-runeterra-gold to-runeterra-gold-light text-runeterra-darker hover:shadow-lg hover:shadow-runeterra-gold/50 rounded-lg font-bold transition-all"
              >
                🔄 Compare Again
              </button>
              <button
                onClick={() => setShowExportModal(true)}
                className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:shadow-lg hover:shadow-emerald-500/50 text-white rounded-lg font-bold transition-all"
              >
                📄 Export Comparison
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Export Modal */}
      {showExportModal && comparisonLore && relationshipType && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={() => setShowExportModal(false)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowExportModal(false)} className="absolute top-4 right-4 z-10 bg-gray-800 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-700 print:hidden">×</button>
            <button onClick={() => window.print()} className="absolute top-4 right-16 z-10 bg-gradient-to-r from-runeterra-gold to-runeterra-gold-light text-runeterra-darker rounded-lg px-4 py-2 hover:shadow-lg print:hidden font-bold">📄 Export PDF</button>
            <div className="p-12 bg-white text-gray-900">
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold mb-2" style={{ color: '#C89B3C' }}>Friend Comparison Report</h1>
                <p className="text-xl text-gray-600">{player1Data?.riotId.split('#')[0]} vs {player2Data?.riotId.split('#')[0]}</p>
              </div>
              <div className={`text-center p-6 rounded-xl mb-8 ${relationshipType === 'allies' ? 'bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-500' : 'bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-500'}`}>
                <div className="text-5xl mb-3">{relationshipType === 'allies' ? '🤝' : '⚔️'}</div>
                <h2 className="text-3xl font-bold mb-2">{relationshipType === 'allies' ? 'Legendary Allies' : 'Arch-Nemeses'}</h2>
                <p className="text-lg text-gray-700">{relationshipType === 'allies' ? 'Your playstyles complement each other perfectly!' : 'Your contrasting styles create an epic rivalry!'}</p>
                {calculateSimilarity && <div className="mt-3 text-gray-600 font-semibold">Similarity Score: {(calculateSimilarity.score * 100).toFixed(1)}%</div>}
              </div>
              <div className="mb-8 p-6 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border-2" style={{ borderColor: '#C89B3C' }}>
                <h3 className="text-2xl font-bold text-center mb-4" style={{ color: '#C89B3C' }}>⚔️ The Legend of {player1Data?.riotId.split('#')[0]} & {player2Data?.riotId.split('#')[0]}</h3>
                <div className="prose prose-lg max-w-none">
                  {comparisonLore.split('\n\n').map((paragraph, idx) => (<p key={idx} className="text-gray-800 leading-relaxed mb-4">{paragraph}</p>))}
                </div>
              </div>
              {statsComparison && (
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-center mb-6 text-purple-900">📊 Head-to-Head Stats</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-sm text-gray-600 mb-2 font-semibold">Average KDA</div>
                      <div className="text-3xl font-bold text-blue-700">{statsComparison.kda.p1.toFixed(2)}</div>
                      <div className="text-xs text-gray-500 mt-1">{player1Data?.riotId.split('#')[0]}</div>
                    </div>
                    <div className="text-center p-4 bg-pink-50 rounded-lg border border-pink-200">
                      <div className="text-sm text-gray-600 mb-2 font-semibold">Average KDA</div>
                      <div className="text-3xl font-bold text-pink-700">{statsComparison.kda.p2.toFixed(2)}</div>
                      <div className="text-xs text-gray-500 mt-1">{player2Data?.riotId.split('#')[0]}</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-sm text-gray-600 mb-2 font-semibold">CS per Minute</div>
                      <div className="text-3xl font-bold text-blue-700">{statsComparison.cs.p1.toFixed(1)}</div>
                      <div className="text-xs text-gray-500 mt-1">{player1Data?.riotId.split('#')[0]}</div>
                    </div>
                    <div className="text-center p-4 bg-pink-50 rounded-lg border border-pink-200">
                      <div className="text-sm text-gray-600 mb-2 font-semibold">CS per Minute</div>
                      <div className="text-3xl font-bold text-pink-700">{statsComparison.cs.p2.toFixed(1)}</div>
                      <div className="text-xs text-gray-500 mt-1">{player2Data?.riotId.split('#')[0]}</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-sm text-gray-600 mb-2 font-semibold">Gold per Minute</div>
                      <div className="text-3xl font-bold text-blue-700">{Math.round(statsComparison.gold.p1)}</div>
                      <div className="text-xs text-gray-500 mt-1">{player1Data?.riotId.split('#')[0]}</div>
                    </div>
                    <div className="text-center p-4 bg-pink-50 rounded-lg border border-pink-200">
                      <div className="text-sm text-gray-600 mb-2 font-semibold">Gold per Minute</div>
                      <div className="text-3xl font-bold text-pink-700">{Math.round(statsComparison.gold.p2)}</div>
                      <div className="text-xs text-gray-500 mt-1">{player2Data?.riotId.split('#')[0]}</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-sm text-gray-600 mb-2 font-semibold">Vision Score</div>
                      <div className="text-3xl font-bold text-blue-700">{Math.round(statsComparison.vision.p1)}</div>
                      <div className="text-xs text-gray-500 mt-1">{player1Data?.riotId.split('#')[0]}</div>
                    </div>
                    <div className="text-center p-4 bg-pink-50 rounded-lg border border-pink-200">
                      <div className="text-sm text-gray-600 mb-2 font-semibold">Vision Score</div>
                      <div className="text-3xl font-bold text-pink-700">{Math.round(statsComparison.vision.p2)}</div>
                      <div className="text-xs text-gray-500 mt-1">{player2Data?.riotId.split('#')[0]}</div>
                    </div>
                  </div>
                </div>
              )}
              <div className="text-center pt-6 border-t border-gray-300">
                <p className="text-gray-600 text-sm">Generated by Rift Rewind • Your League of Legends Journey</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

interface ComparisonStatsChartProps {
  selectedStat: string;
  player1Data: PlayerJourney | null;
  player2Data: PlayerJourney | null;
}

const ComparisonStatsChart: React.FC<ComparisonStatsChartProps> = ({ selectedStat, player1Data, player2Data }) => {
  if (!player1Data || !player2Data) return null;

  const quarterKeys = ['Q1', 'Q2', 'Q3', 'Q4'];
  const periodLabels = ['Early\nSeason', 'Mid\nSeason', 'Late\nSeason', 'End of\nSeason'];

  const p1Stats = quarterKeys.map(qKey => {
    const stat = player1Data.quarters[qKey]?.stats?.[selectedStat as keyof Quarter['stats']] ?? 0;
    return selectedStat === 'vision_score_per_min' ? (stat as number) * 30 : (stat as number);
  });
  const p2Stats = quarterKeys.map(qKey => {
    const stat = player2Data.quarters[qKey]?.stats?.[selectedStat as keyof Quarter['stats']] ?? 0;
    return selectedStat === 'vision_score_per_min' ? (stat as number) * 30 : (stat as number);
  });

  const chartData = quarterKeys.map((_, idx) => ({
    quarter: periodLabels[idx],
    player1: p1Stats[idx],
    player2: p2Stats[idx],
  }));

  const p1Name = player1Data.riotId.split('#')[0];
  const p2Name = player2Data.riotId.split('#')[0];

  const p1Change = p1Stats[3] - p1Stats[0];
  const p2Change = p2Stats[3] - p2Stats[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-runeterra-darker border border-runeterra-gold/50 rounded-lg px-4 py-3 shadow-lg">
          <p className="text-runeterra-gold font-bold text-sm mb-2">{payload[0].payload.quarter}</p>
          <p className="text-cyan-400 text-sm">{p1Name}: {payload[0].value.toFixed(2)}</p>
          <p className="text-pink-400 text-sm">{p2Name}: {payload[1].value.toFixed(2)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(200, 155, 60, 0.2)" />
            <XAxis dataKey="quarter" stroke="#C89B3C" style={{ fontSize: '12px', fontWeight: 'bold' }} />
            <YAxis stroke="#C89B3C" style={{ fontSize: '11px' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="line" />
            <Line type="monotone" dataKey="player1" name={p1Name} stroke="#22d3ee" strokeWidth={3} dot={{ fill: '#22d3ee', r: 5 }} activeDot={{ r: 7 }} />
            <Line type="monotone" dataKey="player2" name={p2Name} stroke="#ec4899" strokeWidth={3} dot={{ fill: '#ec4899', r: 5 }} activeDot={{ r: 7 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-gradient-to-br from-cyan-900/30 to-cyan-800/20 border-2 border-cyan-500/40 rounded-xl p-4 text-center backdrop-blur-sm">
          <div className="text-cyan-400 font-bold mb-2">{p1Name}</div>
          <div className={`text-3xl font-bold ${Math.abs(p1Change) < 0.1 ? 'text-gray-400' : p1Change > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {Math.abs(p1Change) < 0.1 ? '→' : p1Change > 0 ? '↗' : '↘'} {Math.abs(p1Change) < 0.1 ? 'Stable' : `${p1Change > 0 ? '+' : ''}${p1Change.toFixed(2)}`}
          </div>
          <div className="text-xs text-gray-400 mt-1">{p1Stats[0].toFixed(2)} → {p1Stats[3].toFixed(2)}</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-gradient-to-br from-pink-900/30 to-pink-800/20 border-2 border-pink-500/40 rounded-xl p-4 text-center backdrop-blur-sm">
          <div className="text-pink-400 font-bold mb-2">{p2Name}</div>
          <div className={`text-3xl font-bold ${Math.abs(p2Change) < 0.1 ? 'text-gray-400' : p2Change > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {Math.abs(p2Change) < 0.1 ? '→' : p2Change > 0 ? '↗' : '↘'} {Math.abs(p2Change) < 0.1 ? 'Stable' : `${p2Change > 0 ? '+' : ''}${p2Change.toFixed(2)}`}
          </div>
          <div className="text-xs text-gray-400 mt-1">{p2Stats[0].toFixed(2)} → {p2Stats[3].toFixed(2)}</div>
        </motion.div>
      </div>
    </div>
  );
};

interface ComparisonTimelineChartProps {
  selectedValue: string;
  player1Data: PlayerJourney | null;
  player2Data: PlayerJourney | null;
}

const ComparisonTimelineChart: React.FC<ComparisonTimelineChartProps> = ({ selectedValue, player1Data, player2Data }) => {
  if (!player1Data || !player2Data) return null;

  const quarterKeys = ['Q1', 'Q2', 'Q3', 'Q4'];
  const periodLabels = ['Early\nSeason', 'Mid\nSeason', 'Late\nSeason', 'End of\nSeason'];

  const p1Values = quarterKeys.map(qKey => player1Data.quarters[qKey]?.values?.[selectedValue] ?? 50);
  const p2Values = quarterKeys.map(qKey => player2Data.quarters[qKey]?.values?.[selectedValue] ?? 50);

  const chartData = quarterKeys.map((_, idx) => ({
    quarter: periodLabels[idx],
    player1: p1Values[idx],
    player2: p2Values[idx],
  }));

  const p1Name = player1Data.riotId.split('#')[0];
  const p2Name = player2Data.riotId.split('#')[0];

  const p1Change = p1Values[3] - p1Values[0];
  const p2Change = p2Values[3] - p2Values[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-runeterra-darker border border-runeterra-gold/50 rounded-lg px-4 py-3 shadow-lg">
          <p className="text-runeterra-gold font-bold text-sm mb-2">{payload[0].payload.quarter}</p>
          <p className="text-cyan-400 text-sm">{p1Name}: {payload[0].value.toFixed(1)}</p>
          <p className="text-pink-400 text-sm">{p2Name}: {payload[1].value.toFixed(1)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(200, 155, 60, 0.2)" />
            <XAxis dataKey="quarter" stroke="#C89B3C" style={{ fontSize: '12px', fontWeight: 'bold' }} />
            <YAxis stroke="#C89B3C" style={{ fontSize: '11px' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="line" />
            <Line type="monotone" dataKey="player1" name={p1Name} stroke="#22d3ee" strokeWidth={3} dot={{ fill: '#22d3ee', r: 5 }} activeDot={{ r: 7 }} />
            <Line type="monotone" dataKey="player2" name={p2Name} stroke="#ec4899" strokeWidth={3} dot={{ fill: '#ec4899', r: 5 }} activeDot={{ r: 7 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-gradient-to-br from-cyan-900/30 to-cyan-800/20 border-2 border-cyan-500/40 rounded-xl p-4 text-center backdrop-blur-sm">
          <div className="text-cyan-400 font-bold mb-2">{p1Name}</div>
          <div className={`text-3xl font-bold ${Math.abs(p1Change) < 1 ? 'text-gray-400' : p1Change > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {Math.abs(p1Change) < 1 ? '→' : p1Change > 0 ? '↗' : '↘'} {Math.abs(p1Change) < 1 ? 'Stable' : `${p1Change > 0 ? '+' : ''}${p1Change.toFixed(1)} pts`}
          </div>
          <div className="text-xs text-gray-400 mt-1">{p1Values[0].toFixed(1)} → {p1Values[3].toFixed(1)}</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-gradient-to-br from-pink-900/30 to-pink-800/20 border-2 border-pink-500/40 rounded-xl p-4 text-center backdrop-blur-sm">
          <div className="text-pink-400 font-bold mb-2">{p2Name}</div>
          <div className={`text-3xl font-bold ${Math.abs(p2Change) < 1 ? 'text-gray-400' : p2Change > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {Math.abs(p2Change) < 1 ? '→' : p2Change > 0 ? '↗' : '↘'} {Math.abs(p2Change) < 1 ? 'Stable' : `${p2Change > 0 ? '+' : ''}${p2Change.toFixed(1)} pts`}
          </div>
          <div className="text-xs text-gray-400 mt-1">{p2Values[0].toFixed(1)} → {p2Values[3].toFixed(1)}</div>
        </motion.div>
      </div>
    </div>
  );
};

/** NEW: Individual value bar chart comparing averages for the selected value */
interface SingleValueComparisonChartProps {
  selectedValue: string;
  player1Data: PlayerJourney | null;
  player2Data: PlayerJourney | null;
}

const SingleValueComparisonChart: React.FC<SingleValueComparisonChartProps> = ({ selectedValue, player1Data, player2Data }) => {
  if (!player1Data || !player2Data) return null;

  const avgFor = (pj: PlayerJourney, key: string) => {
    const arr = Object.values(pj.quarters).map(q => (q.values?.[key] as number) ?? 0);
    const n = arr.length || 0;
    return n ? arr.reduce((a, b) => a + b, 0) / n : 0;
  };

  const p1 = avgFor(player1Data, selectedValue);
  const p2 = avgFor(player2Data, selectedValue);

  const data = [
    { name: player1Data.riotId.split('#')[0], value: p1 },
    { name: player2Data.riotId.split('#')[0], value: p2 },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-runeterra-darker border border-runeterra-gold/50 rounded-lg px-4 py-3 shadow-lg">
          <p className="text-runeterra-gold font-bold text-sm mb-2">{selectedValue}</p>
          <p className="text-runeterra-gold-light text-sm">{payload[0].payload.name}: {payload[0].value.toFixed(1)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 20, right: 20, top: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(200, 155, 60, 0.2)" />
          <XAxis dataKey="name" stroke="#C89B3C" style={{ fontSize: '12px', fontWeight: 'bold' }} />
          <YAxis stroke="#C89B3C" domain={[0, 100]} style={{ fontSize: '11px' }} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" fill="#22d3ee" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="text-center text-runeterra-gold-light mt-2 text-sm">Average score for “{selectedValue}”</div>
    </div>
  );
};

export default FriendComparison;
