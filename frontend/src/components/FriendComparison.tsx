import { motion } from 'framer-motion';
import { useState, useMemo } from 'react';
import type { Quarter, Finale } from '../api';
import axios from 'axios';

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
        .map(k => ({ name: k, diff: Math.abs(p1Values[k] - p2Values[k]) }))
        .sort((a, b) => a.diff - b.diff)
        .slice(0, 3)
        .map(v => v.name),
      topConflictingValues: commonValues
        .map(k => ({ name: k, diff: Math.abs(p1Values[k] - p2Values[k]) }))
        .sort((a, b) => b.diff - a.diff)
        .slice(0, 3)
        .map(v => v.name)
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

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 ${comparisonLore ? 'p-2 md:p-4' : 'p-4 md:p-8'}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={comparisonLore ? "w-full px-2" : "w-full max-w-7xl mx-auto"}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
              Friend Comparison
            </h1>
            <p className="text-gray-400">Upload two journey files to discover if you're allies or rivals!</p>
          </div>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
          >
            ← Back
          </button>
        </div>

        {/* File Upload Section */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Player 1 */}
          <div className="bg-slate-800/50 backdrop-blur border-2 border-purple-500/30 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-purple-400 mb-4">Player 1</h3>
            {!player1Data ? (
              <label className="block">
                <div className="border-2 border-dashed border-purple-500/50 rounded-xl p-8 text-center cursor-pointer hover:border-purple-400 transition-colors">
                  <div className="text-4xl mb-2">📤</div>
                  <div className="text-gray-400 mb-2">Click to upload journey JSON</div>
                  <div className="text-sm text-gray-500">Player 1's journey data</div>
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
                <div className="bg-purple-500/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-300">{player1Data.riotId}</div>
                  <div className="text-sm text-gray-400 mt-1">
                    {player1Data.finale?.year_summary?.total_games || 0} games • 
                    {player1Data.finale?.year_summary?.total_unique_champions || 0} champions
                  </div>
                </div>
                <button
                  onClick={() => setPlayer1Data(null)}
                  className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Player 2 */}
          <div className="bg-slate-800/50 backdrop-blur border-2 border-pink-500/30 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-pink-400 mb-4">Player 2</h3>
            {!player2Data ? (
              <label className="block">
                <div className="border-2 border-dashed border-pink-500/50 rounded-xl p-8 text-center cursor-pointer hover:border-pink-400 transition-colors">
                  <div className="text-4xl mb-2">📤</div>
                  <div className="text-gray-400 mb-2">Click to upload journey JSON</div>
                  <div className="text-sm text-gray-500">Player 2's journey data</div>
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
                <div className="bg-pink-500/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-pink-300">{player2Data.riotId}</div>
                  <div className="text-sm text-gray-400 mt-1">
                    {player2Data.finale?.year_summary?.total_games || 0} games • 
                    {player2Data.finale?.year_summary?.total_unique_champions || 0} champions
                  </div>
                </div>
                <button
                  onClick={() => setPlayer2Data(null)}
                  className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>

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
              className="px-12 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold text-xl rounded-xl shadow-lg transition-all"
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
            <div className={`text-center p-8 rounded-2xl ${
              relationshipType === 'allies' 
                ? 'bg-gradient-to-r from-blue-600/30 to-green-600/30 border-2 border-green-500' 
                : 'bg-gradient-to-r from-red-600/30 to-orange-600/30 border-2 border-red-500'
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
            <div className="bg-slate-800/50 backdrop-blur border-2 border-purple-500/30 rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                ⚔️ The Legend of {player1Data?.riotId} & {player2Data?.riotId}
              </h3>
              <div className="prose prose-invert max-w-none">
                {comparisonLore.split('\n\n').map((paragraph, idx) => (
                  <p key={idx} className="text-gray-300 leading-relaxed mb-4 text-lg">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>

            {/* Stats Comparison */}
            {statsComparison && (
              <div className="bg-slate-800/50 backdrop-blur border-2 border-purple-500/30 rounded-2xl p-8">
                <h3 className="text-2xl font-bold text-center mb-6 text-purple-400">
                  📊 Head-to-Head Comparison
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  {/* KDA */}
                  <div className="text-center">
                    <div className="text-sm text-gray-400 mb-2">Average KDA</div>
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="text-3xl font-bold text-purple-400">{statsComparison.kda.p1.toFixed(2)}</div>
                        <div className="text-xs text-gray-500">{player1Data?.riotId}</div>
                      </div>
                      <div className="text-2xl mx-4">vs</div>
                      <div className="flex-1">
                        <div className="text-3xl font-bold text-pink-400">{statsComparison.kda.p2.toFixed(2)}</div>
                        <div className="text-xs text-gray-500">{player2Data?.riotId}</div>
                      </div>
                    </div>
                  </div>

                  {/* CS/min */}
                  <div className="text-center">
                    <div className="text-sm text-gray-400 mb-2">Average CS/min</div>
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="text-3xl font-bold text-purple-400">{statsComparison.cs.p1.toFixed(1)}</div>
                        <div className="text-xs text-gray-500">{player1Data?.riotId}</div>
                      </div>
                      <div className="text-2xl mx-4">vs</div>
                      <div className="flex-1">
                        <div className="text-3xl font-bold text-pink-400">{statsComparison.cs.p2.toFixed(1)}</div>
                        <div className="text-xs text-gray-500">{player2Data?.riotId}</div>
                      </div>
                    </div>
                  </div>

                  {/* Gold/min */}
                  <div className="text-center">
                    <div className="text-sm text-gray-400 mb-2">Average Gold/min</div>
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="text-3xl font-bold text-purple-400">{statsComparison.gold.p1.toFixed(0)}</div>
                        <div className="text-xs text-gray-500">{player1Data?.riotId}</div>
                      </div>
                      <div className="text-2xl mx-4">vs</div>
                      <div className="flex-1">
                        <div className="text-3xl font-bold text-pink-400">{statsComparison.gold.p2.toFixed(0)}</div>
                        <div className="text-xs text-gray-500">{player2Data?.riotId}</div>
                      </div>
                    </div>
                  </div>

                  {/* Vision */}
                  <div className="text-center">
                    <div className="text-sm text-gray-400 mb-2">Average Vision Score</div>
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="text-3xl font-bold text-purple-400">{statsComparison.vision.p1.toFixed(0)}</div>
                        <div className="text-xs text-gray-500">{player1Data?.riotId}</div>
                      </div>
                      <div className="text-2xl mx-4">vs</div>
                      <div className="flex-1">
                        <div className="text-3xl font-bold text-pink-400">{statsComparison.vision.p2.toFixed(0)}</div>
                        <div className="text-xs text-gray-500">{player2Data?.riotId}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Shared/Conflicting Values */}
            {calculateSimilarity && calculateSimilarity.topSharedValues && calculateSimilarity.topConflictingValues && (
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-green-900/20 border-2 border-green-500/30 rounded-xl p-6">
                  <h4 className="text-lg font-bold text-green-400 mb-3">✨ Shared Strengths</h4>
                  <div className="space-y-2">
                    {calculateSimilarity.topSharedValues.map((value, idx) => (
                      <div key={idx} className="bg-green-500/10 rounded-lg px-3 py-2 text-green-300">
                        {value}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-red-900/20 border-2 border-red-500/30 rounded-xl p-6">
                  <h4 className="text-lg font-bold text-red-400 mb-3">⚡ Contrasting Values</h4>
                  <div className="space-y-2">
                    {calculateSimilarity.topConflictingValues.map((value, idx) => (
                      <div key={idx} className="bg-red-500/10 rounded-lg px-3 py-2 text-red-300">
                        {value}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  setComparisonLore('');
                  setRelationshipType(null);
                }}
                className="px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
              >
                🔄 Compare Again
              </button>
              <button
                onClick={() => setShowExportModal(true)}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-semibold transition-colors"
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
              className="absolute top-4 right-16 z-10 bg-purple-600 text-white rounded-lg px-4 py-2 hover:bg-purple-700 print:hidden font-semibold"
            >
              📄 Export PDF
            </button>

            {/* Export Content */}
            <div className="p-12 bg-white text-gray-900">
              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Friend Comparison Report
                </h1>
                <p className="text-xl text-gray-600">
                  {player1Data?.riotId.split('#')[0]} vs {player2Data?.riotId.split('#')[0]}
                </p>
              </div>

              {/* Relationship Banner */}
              <div className={`text-center p-6 rounded-xl mb-8 ${
                relationshipType === 'allies' 
                  ? 'bg-gradient-to-r from-blue-100 to-green-100 border-2 border-green-500' 
                  : 'bg-gradient-to-r from-red-100 to-orange-100 border-2 border-red-500'
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
              <div className="mb-8 p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                <h3 className="text-2xl font-bold text-center mb-4 text-purple-900">
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

              {/* Shared Values / Contrasting Values */}
              {calculateSimilarity && calculateSimilarity.topSharedValues && calculateSimilarity.topConflictingValues && (
                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="p-6 bg-green-50 rounded-lg border border-green-300">
                    <h4 className="text-xl font-bold text-center mb-4 text-green-800">
                      ✨ Shared Strengths
                    </h4>
                    <ul className="space-y-2">
                      {calculateSimilarity.topSharedValues.map((value, idx) => (
                        <li key={idx} className="text-gray-800 flex items-center gap-2">
                          <span className="text-green-600">●</span>
                          <span className="font-semibold">{value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-6 bg-orange-50 rounded-lg border border-orange-300">
                    <h4 className="text-xl font-bold text-center mb-4 text-orange-800">
                      ⚡ Contrasting Values
                    </h4>
                    <ul className="space-y-2">
                      {calculateSimilarity.topConflictingValues.map((value, idx) => (
                        <li key={idx} className="text-gray-800 flex items-center gap-2">
                          <span className="text-orange-600">●</span>
                          <span className="font-semibold">{value}</span>
                        </li>
                      ))}
                    </ul>
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

export default FriendComparison;
