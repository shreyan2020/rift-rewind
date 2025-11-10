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
        
        if (playerNum === 1) {
          setPlayer1Data(playerData);
        } else {
          setPlayer2Data(playerData);
        }
        setError('');
      } catch (err) {
        setError(`Failed to parse Player ${playerNum}'s file. Please upload a valid journey JSON.`);
      }
    };
    reader.readAsText(file);
  };

  // Calculate similarity between two players
  const calculateSimilarity = useMemo(() => {
    if (!player1Data || !player2Data) return null;

    // Compare average values across all quarters
    const getAvgValues = (quarters: Record<string, Quarter>) => {
      const allValues: Record<string, number[]> = {};
      Object.values(quarters).forEach(q => {
        Object.entries(q.values || {}).forEach(([name, value]) => {
          if (!allValues[name]) allValues[name] = [];
          allValues[name].push(value);
        });
      });
      
      const avgValues: Record<string, number> = {};
      Object.entries(allValues).forEach(([name, values]) => {
        avgValues[name] = values.reduce((a, b) => a + b, 0) / values.length;
      });
      return avgValues;
    };

    const p1Values = getAvgValues(player1Data.quarters);
    const p2Values = getAvgValues(player2Data.quarters);

    // Calculate cosine similarity
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

    const similarity = dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
    
    // > 0.7 = allies, < 0.7 = rivals
    return {
      score: similarity,
      type: similarity > 0.7 ? 'allies' as const : 'rivals' as const,
      topSharedValues: commonValues
        .map(k => ({ name: k, diff: Math.abs(p1Values[k] - p2Values[k]), p1: p1Values[k], p2: p2Values[k] }))
        .filter(v => !(v.p1 === 0 && v.p2 === 0)) // Filter out values where both players have 0
        .sort((a, b) => a.diff - b.diff)
        .slice(0, 3)
        .map(v => ({ name: v.name, p1: v.p1, p2: v.p2 })),
      topConflictingValues: commonValues
        .map(k => ({ name: k, diff: Math.abs(p1Values[k] - p2Values[k]), p1: p1Values[k], p2: p2Values[k] }))
        .filter(v => !(v.p1 === 0 && v.p2 === 0)) // Filter out values where both players have 0
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
      const API_BASE_URL = 'https://vassfd5se4.execute-api.eu-west-1.amazonaws.com';
      
      const relationship = calculateSimilarity.type;
      setRelationshipType(relationship);

      // Prepare comparison data
      const comparisonData = {
        player1: {
          name: player1Data.riotId,
          totalGames: player1Data.finale?.year_summary?.total_games || 0,
          topValues: Object.entries(player1Data.quarters)
            .flatMap(([_, q]) => q.top_values?.slice(0, 3) || [])
            .slice(0, 5),
          topChampion: player1Data.finale?.champion_analysis?.top_champions?.[0]?.name || 'Unknown'
        },
        player2: {
          name: player2Data.riotId,
          totalGames: player2Data.finale?.year_summary?.total_games || 0,
          topValues: Object.entries(player2Data.quarters)
            .flatMap(([_, q]) => q.top_values?.slice(0, 3) || [])
            .slice(0, 5),
          topChampion: player2Data.finale?.champion_analysis?.top_champions?.[0]?.name || 'Unknown'
        },
        relationship: relationship,
        sharedValues: calculateSimilarity.topSharedValues,
        conflictingValues: calculateSimilarity.topConflictingValues,
        similarityScore: calculateSimilarity.score
      };

      // Call backend to generate lore
      const response = await axios.post(`${API_BASE_URL}/journey/compare`, comparisonData);
      
      if (response.data && response.data.lore) {
        setComparisonLore(response.data.lore);
      } else {
        throw new Error('No lore generated');
      }
    } catch (err) {
      console.error('Failed to generate comparison lore:', err);
      // Fallback to client-side generation
      generateFallbackLore();
    } finally {
      setIsGenerating(false);
    }
  };

  const generateFallbackLore = () => {
    if (!player1Data || !player2Data || !calculateSimilarity) return;

    const p1Name = player1Data.riotId.split('#')[0]; // Extract just the name part
    const p2Name = player2Data.riotId.split('#')[0];
    const p1Archetype = player1Data.metadata?.archetype || 'warrior';
    const p2Archetype = player2Data.metadata?.archetype || 'warrior';
    const relationship = calculateSimilarity.type;

    // Map archetypes to character descriptions
    const archetypeDescriptions: Record<string, string> = {
      explorer: 'a bold explorer seeking hidden truths',
      warrior: 'a fierce warrior forged in battle',
      sage: 'a wise sage mastering ancient knowledge',
      guardian: 'a steadfast guardian protecting the innocent'
    };

    const p1Desc = archetypeDescriptions[p1Archetype] || 'a legendary champion';
    const p2Desc = archetypeDescriptions[p2Archetype] || 'a legendary champion';

    if (relationship === 'allies') {
      setComparisonLore(
        `In the mystical lands of Runeterra, two champions emerged from different corners of the realm. ` +
        `${p1Name}, ${p1Desc}, and ${p2Name}, ${p2Desc}, crossed paths during the great Convergence. ` +
        `\n\nThough their journeys began in different regions, they discovered their fighting styles complemented each other perfectly. ` +
        `${p1Name}'s expertise combined with ${p2Name}'s prowess created an unstoppable force. ` +
        `\n\nTogether, they embarked on an epic quest to defeat the Shadow Council that threatened to plunge Runeterra into eternal darkness. ` +
        `Through countless battles across Noxus, Demacia, and Ionia, their bond grew stronger with each victory. ` +
        `\n\nIn the final confrontation atop Mount Targon, they stood side by side against the Shadow Council's champion. ` +
        `Their combined abilities created a storm of power that shattered the darkness forever. ` +
        `\n\nRuneterra would remember them not as individuals, but as legendary allies whose friendship saved the realm. ` +
        `Their tale became a beacon of hope—proof that unity conquers all.`
      );
    } else {
      setComparisonLore(
        `Two titans rose from opposite ends of Runeterra. ${p1Name}, ${p1Desc}, and ${p2Name}, ${p2Desc}, ` +
        `were destined to clash from the moment they first heard of each other's exploits. ` +
        `\n\nTheir rivalry ignited in the Noxian arena, where ${p1Name} emerged victorious by the narrowest margin. ` +
        `Refusing to accept defeat, ${p2Name} swore to train harder, seeking ancient techniques in the shadowed monasteries of Ionia. ` +
        `\n\nAs seasons passed, their confrontations became the stuff of legend. Every region of Runeterra witnessed their spectacular duels. ` +
        `In Demacia's Grand Plaza, their battle lasted three days and nights. ` +
        `In Bilgewater's harbor, they fought atop a burning ship as cannon fire lit the sky. ` +
        `In the depths of Zaun, their clash created a crater visible from Piltover's highest towers. ` +
        `\n\nNeither could claim absolute supremacy, for each encounter ended with mutual respect and renewed determination. ` +
        `\n\nTheir eternal rivalry became legendary—two arch-nemeses locked in an endless dance of combat that would echo through the ages. ` +
        `Bards composed songs of their battles, children reenacted their duels in the streets, and aspiring warriors studied their techniques. ` +
        `\n\nFor in Runeterra, the greatest tales are not always of triumph, but of rivalries that forge legends and push champions to transcend their limits.`
      );
    }
    setRelationshipType(relationship);
  };

  // Stats comparison
  const statsComparison = useMemo(() => {
    if (!player1Data || !player2Data) return null;

    const getAvgStat = (quarters: Record<string, Quarter>, stat: keyof Quarter['stats']) => {
      const values = Object.values(quarters).map(q => q.stats?.[stat] || 0);
      return values.reduce((a, b) => a + b, 0) / values.length;
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

  // Get all unique values from both players for dropdown
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
            <p className="text-runeterra-gold-light text-lg">Upload two journey files to discover if you're allies or rivals!</p>
          </div>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-gradient-to-r from-runeterra-gold to-runeterra-gold-light text-runeterra-darker hover:shadow-lg hover:shadow-runeterra-gold/50 rounded-lg font-bold transition-all"
          >
            ← Back
          </button>
        </div>

        {/* File Upload Section - Only show when no comparison is generated */}
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center mb-8 no-print"
          >
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
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
                <h3 className="text-2xl font-bold text-center mb-6 text-runeterra-gold">
                  📊 Head-to-Head Comparison
                </h3>
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
                  <p className="text-runeterra-gold-light text-xs mt-1 ml-11">
                    Each player's matches divided into 4 equal periods
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-runeterra-gold-light text-sm font-medium">
                    Select Stat:
                  </label>
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
                <ComparisonStatsChart 
                  selectedStat={selectedStat} 
                  player1Data={player1Data} 
                  player2Data={player2Data}
                />
              ) : (
                <div className="text-center text-runeterra-gold-light/50 py-16">
                  Select a stat to compare trajectories
                </div>
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
                  <p className="text-runeterra-gold-light text-xs mt-1 ml-11">
                    Each player's matches divided into 4 equal periods
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-runeterra-gold-light text-sm font-medium">
                    Select Value:
                  </label>
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
                <ComparisonTimelineChart 
                  selectedValue={selectedValue} 
                  player1Data={player1Data} 
                  player2Data={player2Data}
                />
              ) : (
                <div className="text-center text-runeterra-gold-light/50 py-16">
                  Select a value to compare trajectories
                </div>
              )}
            </div>

            {/* Aggregated Values Comparison Bar Chart */}
            {calculateSimilarity && (
              <div className="bg-runeterra-dark/50 backdrop-blur-sm border border-runeterra-gold/30 rounded-lg p-8">
                <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                  <div>
                    <h3 className="text-2xl font-bold text-runeterra-gold flex items-center gap-3">
                      <span className="text-3xl">📊</span>
                      Individual Value Comparison
                    </h3>
                    <p className="text-runeterra-gold-light text-sm mt-2 ml-11">
                      Compare a specific Schwartz value between both players
                    </p>
                    <p className="text-gray-400 text-xs mt-1 ml-11 italic">
                      Raw scores: Higher = stronger expression. Directly comparable between players.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-runeterra-gold-light text-sm font-medium">
                      Select Value:
                    </label>
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
                  <SingleValueComparisonChart 
                    selectedValue={selectedValue}
                    player1Data={player1Data} 
                    player2Data={player2Data}
                  />
                ) : (
                  <div className="text-center text-runeterra-gold-light/50 py-16">
                    Select a value to compare
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  setComparisonLore('');
                  setRelationshipType(null);
                }}
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setShowExportModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowExportModal(false)}
              className="absolute top-4 right-4 z-10 bg-gray-800 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-700 print:hidden"
            >
              ×
            </button>

            {/* Print button */}
            <button
              onClick={() => window.print()}
              className="absolute top-4 right-16 z-10 bg-gradient-to-r from-runeterra-gold to-runeterra-gold-light text-runeterra-darker rounded-lg px-4 py-2 hover:shadow-lg print:hidden font-bold"
            >
              📄 Export PDF
            </button>

            {/* Export Content */}
            <div className="p-12 bg-white text-gray-900">
              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold mb-2" style={{ color: '#C89B3C' }}>
                  Friend Comparison Report
                </h1>
                <p className="text-xl text-gray-600">
                  {player1Data?.riotId.split('#')[0]} vs {player2Data?.riotId.split('#')[0]}
                </p>
              </div>

              {/* Relationship Banner */}
              <div className={`text-center p-6 rounded-xl mb-8 ${
                relationshipType === 'allies' 
                  ? 'bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-500' 
                  : 'bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-500'
              }`}>
                <div className="text-5xl mb-3">
                  {relationshipType === 'allies' ? '🤝' : '⚔️'}
                </div>
                <h2 className="text-3xl font-bold mb-2">
                  {relationshipType === 'allies' ? 'Legendary Allies' : 'Arch-Nemeses'}
                </h2>
                <p className="text-lg text-gray-700">
                  {relationshipType === 'allies' 
                    ? 'Your playstyles complement each other perfectly!' 
                    : 'Your contrasting styles create an epic rivalry!'}
                </p>
                {calculateSimilarity && (
                  <div className="mt-3 text-gray-600 font-semibold">
                    Similarity Score: {(calculateSimilarity.score * 100).toFixed(1)}%
                  </div>
                )}
              </div>

              {/* The Epic Lore */}
              <div className="mb-8 p-6 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border-2" style={{ borderColor: '#C89B3C' }}>
                <h3 className="text-2xl font-bold text-center mb-4" style={{ color: '#C89B3C' }}>
                  ⚔️ The Legend of {player1Data?.riotId.split('#')[0]} & {player2Data?.riotId.split('#')[0]}
                </h3>
                <div className="prose prose-lg max-w-none">
                  {comparisonLore.split('\n\n').map((paragraph, idx) => (
                    <p key={idx} className="text-gray-800 leading-relaxed mb-4">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>

              {/* Stats Comparison */}
              {statsComparison && (
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-center mb-6 text-purple-900">
                    📊 Head-to-Head Stats
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {/* KDA */}
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

                    {/* CS */}
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

                    {/* Gold */}
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

                    {/* Vision */}
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

              {/* Footer */}
              <div className="text-center pt-6 border-t border-gray-300">
                <p className="text-gray-600 text-sm">
                  Generated by Rift Rewind • Your League of Legends Journey
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

// Comparison Stats Chart Component
interface ComparisonStatsChartProps {
  selectedStat: string;
  player1Data: PlayerJourney | null;
  player2Data: PlayerJourney | null;
}

const ComparisonStatsChart: React.FC<ComparisonStatsChartProps> = ({ 
  selectedStat, 
  player1Data, 
  player2Data 
}) => {
  if (!player1Data || !player2Data) return null;

  const quarterKeys = ['Q1', 'Q2', 'Q3', 'Q4'];
  const periodLabels = ['Early\nSeason', 'Mid\nSeason', 'Late\nSeason', 'End of\nSeason'];
  
  // Get stat values for both players
  const p1Stats = quarterKeys.map(qKey => {
    const stat = player1Data.quarters[qKey]?.stats?.[selectedStat as keyof Quarter['stats']] ?? 0;
    // Scale vision score for better visualization (multiply by 30 for average game)
    return selectedStat === 'vision_score_per_min' ? stat * 30 : stat;
  });
  
  const p2Stats = quarterKeys.map(qKey => {
    const stat = player2Data.quarters[qKey]?.stats?.[selectedStat as keyof Quarter['stats']] ?? 0;
    return selectedStat === 'vision_score_per_min' ? stat * 30 : stat;
  });
  
  // Prepare data for Recharts
  const chartData = quarterKeys.map((_, idx) => ({
    quarter: periodLabels[idx],
    player1: p1Stats[idx],
    player2: p2Stats[idx],
  }));

  const p1Name = player1Data.riotId.split('#')[0];
  const p2Name = player2Data.riotId.split('#')[0];

  // Calculate changes
  const p1Change = p1Stats[3] - p1Stats[0];
  const p2Change = p2Stats[3] - p2Stats[0];

  // Custom tooltip
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
      {/* Recharts Line Chart */}
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(200, 155, 60, 0.2)" />
            <XAxis 
              dataKey="quarter" 
              stroke="#C89B3C"
              style={{ fontSize: '12px', fontWeight: 'bold' }}
            />
            <YAxis 
              stroke="#C89B3C"
              style={{ fontSize: '11px' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
            <Line 
              type="monotone" 
              dataKey="player1" 
              name={p1Name}
              stroke="#22d3ee" 
              strokeWidth={3}
              dot={{ fill: '#22d3ee', r: 5 }}
              activeDot={{ r: 7 }}
            />
            <Line 
              type="monotone" 
              dataKey="player2" 
              name={p2Name}
              stroke="#ec4899" 
              strokeWidth={3}
              dot={{ fill: '#ec4899', r: 5 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Trend Summary */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-gradient-to-br from-cyan-900/30 to-cyan-800/20 border-2 border-cyan-500/40 rounded-xl p-4 text-center backdrop-blur-sm"
        >
          <div className="text-cyan-400 font-bold mb-2">{p1Name}</div>
          <div className={`text-3xl font-bold ${
            Math.abs(p1Change) < 0.1 ? 'text-gray-400' : 
            p1Change > 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {Math.abs(p1Change) < 0.1 ? '→' : p1Change > 0 ? '↗' : '↘'}
            {' '}
            {Math.abs(p1Change) < 0.1 ? 'Stable' : `${p1Change > 0 ? '+' : ''}${p1Change.toFixed(2)}`}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {p1Stats[0].toFixed(2)} → {p1Stats[3].toFixed(2)}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-gradient-to-br from-pink-900/30 to-pink-800/20 border-2 border-pink-500/40 rounded-xl p-4 text-center backdrop-blur-sm"
        >
          <div className="text-pink-400 font-bold mb-2">{p2Name}</div>
          <div className={`text-3xl font-bold ${
            Math.abs(p2Change) < 0.1 ? 'text-gray-400' : 
            p2Change > 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {Math.abs(p2Change) < 0.1 ? '→' : p2Change > 0 ? '↗' : '↘'}
            {' '}
            {Math.abs(p2Change) < 0.1 ? 'Stable' : `${p2Change > 0 ? '+' : ''}${p2Change.toFixed(2)}`}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {p2Stats[0].toFixed(2)} → {p2Stats[3].toFixed(2)}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// Comparison Timeline Chart Component
interface ComparisonTimelineChartProps {
  selectedValue: string;
  player1Data: PlayerJourney | null;
  player2Data: PlayerJourney | null;
}

const ComparisonTimelineChart: React.FC<ComparisonTimelineChartProps> = ({ 
  selectedValue, 
  player1Data, 
  player2Data 
}) => {
  if (!player1Data || !player2Data) return null;

  const quarterKeys = ['Q1', 'Q2', 'Q3', 'Q4'];
  const periodLabels = ['Early\nSeason', 'Mid\nSeason', 'Late\nSeason', 'End of\nSeason'];
  
  // Get values for both players
  const p1Values = quarterKeys.map(qKey => player1Data.quarters[qKey]?.values?.[selectedValue] ?? 50);
  const p2Values = quarterKeys.map(qKey => player2Data.quarters[qKey]?.values?.[selectedValue] ?? 50);
  
  // Prepare data for Recharts
  const chartData = quarterKeys.map((_, idx) => ({
    quarter: periodLabels[idx],
    player1: p1Values[idx],
    player2: p2Values[idx],
  }));

  const p1Name = player1Data.riotId.split('#')[0];
  const p2Name = player2Data.riotId.split('#')[0];

  // Calculate changes
  const p1Change = p1Values[3] - p1Values[0];
  const p2Change = p2Values[3] - p2Values[0];

  // Custom tooltip
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
      {/* Recharts Line Chart */}
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(200, 155, 60, 0.2)" />
            <XAxis 
              dataKey="quarter" 
              stroke="#C89B3C"
              style={{ fontSize: '12px', fontWeight: 'bold' }}
            />
            <YAxis 
              stroke="#C89B3C"
              style={{ fontSize: '11px' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
            <Line 
              type="monotone" 
              dataKey="player1" 
              name={p1Name}
              stroke="#22d3ee" 
              strokeWidth={3}
              dot={{ fill: '#22d3ee', r: 5 }}
              activeDot={{ r: 7 }}
            />
            <Line 
              type="monotone" 
              dataKey="player2" 
              name={p2Name}
              stroke="#ec4899" 
              strokeWidth={3}
              dot={{ fill: '#ec4899', r: 5 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Trend Summary */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-gradient-to-br from-cyan-900/30 to-cyan-800/20 border-2 border-cyan-500/40 rounded-xl p-4 text-center backdrop-blur-sm"
        >
          <div className="text-cyan-400 font-bold mb-2">{p1Name}</div>
          <div className={`text-3xl font-bold ${
            Math.abs(p1Change) < 1 ? 'text-gray-400' : 
            p1Change > 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {Math.abs(p1Change) < 1 ? '→' : p1Change > 0 ? '↗' : '↘'}
            {' '}
            {Math.abs(p1Change) < 1 ? 'Stable' : `${p1Change > 0 ? '+' : ''}${p1Change.toFixed(1)} pts`}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {p1Values[0].toFixed(1)} → {p1Values[3].toFixed(1)}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-gradient-to-br from-pink-900/30 to-pink-800/20 border-2 border-pink-500/40 rounded-xl p-4 text-center backdrop-blur-sm"
        >
          <div className="text-pink-400 font-bold mb-2">{p2Name}</div>
          <div className={`text-3xl font-bold ${
            Math.abs(p2Change) < 1 ? 'text-gray-400' : 
            p2Change > 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {Math.abs(p2Change) < 1 ? '→' : p2Change > 0 ? '↗' : '↘'}
            {' '}
            {Math.abs(p2Change) < 1 ? 'Stable' : `${p2Change > 0 ? '+' : ''}${p2Change.toFixed(1)} pts`}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {p2Values[0].toFixed(1)} → {p2Values[3].toFixed(1)}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// Single Value Comparison Component (Aggregate)
interface SingleValueComparisonChartProps {
  selectedValue: string;
  player1Data: PlayerJourney | null;
  player2Data: PlayerJourney | null;
}

const SingleValueComparisonChart: React.FC<SingleValueComparisonChartProps> = ({ 
  selectedValue,
  player1Data, 
  player2Data 
}) => {
  if (!player1Data || !player2Data) return null;

  // Calculate average value across all quarters for both players
  const getAvgValue = (quarters: Record<string, Quarter>, valueName: string) => {
    const values: number[] = [];
    Object.values(quarters).forEach(q => {
      if (q.values && valueName in q.values) {
        values.push(q.values[valueName]);
      }
    });
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  };

  const p1Avg = getAvgValue(player1Data.quarters, selectedValue);
  const p2Avg = getAvgValue(player2Data.quarters, selectedValue);

  const p1Name = player1Data.riotId.split('#')[0];
  const p2Name = player2Data.riotId.split('#')[0];

  // Value descriptions for education
  const valueDescriptions: Record<string, string> = {
    "Power": "Dominance through gold and damage - assertive play",
    "Achievement": "Success metrics - first bloods, KDA, team damage",
    "Hedonism": "Fun/risky plays - fountain kills, creative mechanics",
    "Stimulation": "Exciting moments - steals, outplays, high-risk plays",
    "Self-Direction": "Independent decision-making - solo kills, strategic choices",
    "Benevolence": "Team-oriented play - assists, vision, objective focus",
    "Tradition": "Classic fundamentals - CS, farming, laning discipline",
    "Conformity": "Safe, coordinated play - vision control, low deaths",
    "Security": "Defensive awareness - vision, positioning, risk avoidance",
    "Universalism": "Versatility - diverse champion pool and roles"
  };

  const description = valueDescriptions[selectedValue] || "Behavioral value score";

  return (
    <div className="space-y-6">
      {/* Description Box */}
      <div className="bg-runeterra-darker/50 border border-runeterra-gold/20 rounded-lg p-4">
        <h4 className="text-lg font-bold text-runeterra-gold mb-2">{selectedValue}</h4>
        <p className="text-runeterra-gold-light text-sm">{description}</p>
        <p className="text-gray-400 text-xs mt-2 italic">
          Higher scores indicate stronger expression of this behavioral pattern across all matches.
        </p>
      </div>

      {/* Bar Chart Comparison */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={[
              { player: p1Name, value: p1Avg },
              { player: p2Name, value: p2Avg }
            ]}
            margin={{ left: 40, right: 40, top: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(200, 155, 60, 0.2)" />
            <XAxis 
              dataKey="player" 
              stroke="#C89B3C"
              style={{ fontSize: '14px', fontWeight: 'bold' }}
            />
            <YAxis 
              stroke="#C89B3C"
              style={{ fontSize: '12px' }}
              label={{ value: 'Score', angle: -90, position: 'insideLeft', style: { fill: '#C89B3C' } }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#0a1428',
                border: '1px solid rgba(200, 155, 60, 0.5)',
                borderRadius: '8px'
              }}
              formatter={(value: number) => [value.toFixed(2), 'Score']}
            />
            <Bar 
              dataKey="value"
              fill="#C89B3C"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Comparison Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-cyan-900/30 to-cyan-800/20 border-2 border-cyan-500/40 rounded-xl p-4 text-center">
          <div className="text-cyan-400 font-bold mb-2">{p1Name}</div>
          <div className="text-4xl font-bold text-cyan-300">{p1Avg.toFixed(2)}</div>
        </div>
        <div className="bg-gradient-to-br from-pink-900/30 to-pink-800/20 border-2 border-pink-500/40 rounded-xl p-4 text-center">
          <div className="text-pink-400 font-bold mb-2">{p2Name}</div>
          <div className="text-4xl font-bold text-pink-300">{p2Avg.toFixed(2)}</div>
        </div>
      </div>

      {/* Winner/Analysis */}
      <div className="bg-runeterra-darker/30 border border-runeterra-gold/20 rounded-lg p-4 text-center">
        {Math.abs(p1Avg - p2Avg) < 0.1 ? (
          <p className="text-runeterra-gold-light">
            <span className="text-runeterra-gold font-bold">Nearly Equal!</span> Both players show similar expression of {selectedValue}.
          </p>
        ) : p1Avg > p2Avg ? (
          <p className="text-runeterra-gold-light">
            <span className="text-cyan-400 font-bold">{p1Name}</span> shows{' '}
            <span className="text-runeterra-gold font-bold">{((p1Avg / p2Avg - 1) * 100).toFixed(0)}% higher</span>{' '}
            {selectedValue} expression
          </p>
        ) : (
          <p className="text-runeterra-gold-light">
            <span className="text-pink-400 font-bold">{p2Name}</span> shows{' '}
            <span className="text-runeterra-gold font-bold">{((p2Avg / p1Avg - 1) * 100).toFixed(0)}% higher</span>{' '}
            {selectedValue} expression
          </p>
        )}
      </div>
    </div>
  );
};

export default FriendComparison;
