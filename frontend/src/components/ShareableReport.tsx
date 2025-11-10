import { motion } from 'framer-motion';
import { useMemo } from 'react';
import type { Quarter, Finale } from '../api';

interface ShareableReportProps {
  quarters: Record<string, Quarter>;
  riotId: string;
  finaleData: Finale | null;
  onClose: () => void;
}

const ShareableReport: React.FC<ShareableReportProps> = ({ quarters, riotId, finaleData, onClose }) => {
  const totalGames = finaleData?.year_summary?.total_games || 0;
  const totalChampions = finaleData?.year_summary?.total_unique_champions || 0;

  // Calculate year stats
  const avgKDA = useMemo(() => {
    const quarters_list = Object.values(quarters);
    if (quarters_list.length === 0) return '0.00';
    const sum = quarters_list.reduce((acc, q) => acc + (q.stats?.kda_proxy || 0), 0);
    return (sum / quarters_list.length).toFixed(2);
  }, [quarters]);

  const avgCS = useMemo(() => {
    const quarters_list = Object.values(quarters);
    if (quarters_list.length === 0) return '0.0';
    const sum = quarters_list.reduce((acc, q) => acc + (q.stats?.cs_per_min || 0), 0);
    return (sum / quarters_list.length).toFixed(1);
  }, [quarters]);

  const avgVision = useMemo(() => {
    const quarters_list = Object.values(quarters);
    if (quarters_list.length === 0) return 0;
    const sum = quarters_list.reduce((acc, q) => acc + (q.stats?.vision_score_per_min || 0) * 30, 0);
    return Math.round(sum / quarters_list.length);
  }, [quarters]);

  // Get top 5 values across all quarters
  const topValues = useMemo(() => {
    const valueAverages: Record<string, number> = {};
    
    Object.values(quarters).forEach(q => {
      Object.entries(q.values || {}).forEach(([name, value]) => {
        if (!valueAverages[name]) valueAverages[name] = 0;
        valueAverages[name] += value;
      });
    });
    
    return Object.entries(valueAverages)
      .map(([name, sum]) => ({ name, avg: sum / 4 }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);
  }, [quarters]);

  // Get champion data
  const topChampions = useMemo(() => {
    const championData = finaleData?.champion_analysis;
    if (!championData) return [];
    return championData.top_champions?.slice(0, 5) || [];
  }, [finaleData]);

  // Get improvements
  const improvements = useMemo(() => {
    if (!finaleData?.trends) return [];
    
    const trends = finaleData.trends;
    const improvements_list = [];
    
    if (trends.kda_trend?.change_percentage && trends.kda_trend.change_percentage > 0) {
      improvements_list.push({ stat: 'KDA', change: `+${trends.kda_trend.change_percentage.toFixed(1)}%`, direction: trends.kda_trend.direction });
    }
    if (trends.cs_trend?.change_percentage && trends.cs_trend.change_percentage > 0) {
      improvements_list.push({ stat: 'CS/min', change: `+${trends.cs_trend.change_percentage.toFixed(1)}%`, direction: trends.cs_trend.direction });
    }
    if (trends.vision_trend?.change_percentage && trends.vision_trend.change_percentage > 0) {
      improvements_list.push({ stat: 'Vision', change: `+${trends.vision_trend.change_percentage.toFixed(1)}%`, direction: trends.vision_trend.direction });
    }
    if (trends.gold_trend?.change_percentage && trends.gold_trend.change_percentage > 0) {
      improvements_list.push({ stat: 'Gold/min', change: `+${trends.gold_trend.change_percentage.toFixed(1)}%`, direction: trends.gold_trend.direction });
    }
    
    return improvements_list;
  }, [finaleData]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button - hidden when printing */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-gray-800 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-700 print:hidden"
        >
          ×
        </button>

        {/* Print button - hidden when printing */}
        <button
          onClick={handlePrint}
          className="absolute top-4 right-16 z-10 bg-purple-600 text-white rounded-lg px-4 py-2 hover:bg-purple-700 print:hidden font-semibold"
        >
          📄 Export PDF
        </button>

        {/* Report Content - optimized for A4 printing */}
        <div id="shareable-report" className="p-12 bg-white text-gray-900">
          {/* Header */}
          <div className="text-center mb-8 pb-6 border-b-4 border-purple-600">
            <div className="text-sm font-bold text-purple-600 mb-2 tracking-wider">RIFT REWIND 2025</div>
            <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {riotId}
            </h1>
            <p className="text-lg text-gray-600">Your League of Legends Journey Through Runeterra</p>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200">
              <div className="text-4xl font-bold text-purple-700">{totalGames}</div>
              <div className="text-sm text-gray-700 font-semibold mt-1">Total Games</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl border-2 border-pink-200">
              <div className="text-4xl font-bold text-pink-700">{totalChampions}</div>
              <div className="text-sm text-gray-700 font-semibold mt-1">Champions Played</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border-2 border-yellow-200">
              <div className="text-4xl font-bold text-yellow-700">{avgKDA}</div>
              <div className="text-sm text-gray-700 font-semibold mt-1">Average KDA</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200">
              <div className="text-4xl font-bold text-blue-700">{avgCS}</div>
              <div className="text-sm text-gray-700 font-semibold mt-1">Avg CS/min</div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Top Values */}
              <div className="bg-gradient-to-br from-purple-50 to-white p-6 rounded-xl border-2 border-purple-200">
                <h3 className="text-xl font-bold text-purple-900 mb-4 flex items-center">
                  <span className="text-2xl mr-2">⭐</span>
                  Your Top Values
                </h3>
                <div className="space-y-3">
                  {topValues.map((value, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-purple-700">#{idx + 1}</span>
                        <span className="font-semibold text-gray-800">{value.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full"
                            style={{ width: `${value.avg}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-purple-700 w-8">{value.avg.toFixed(0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Improvements */}
              {improvements.length > 0 && (
                <div className="bg-gradient-to-br from-green-50 to-white p-6 rounded-xl border-2 border-green-200">
                  <h3 className="text-xl font-bold text-green-900 mb-4 flex items-center">
                    <span className="text-2xl mr-2">📈</span>
                    Biggest Improvements
                  </h3>
                  <div className="space-y-2">
                    {improvements.map((imp, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b border-green-100 last:border-0">
                        <span className="font-semibold text-gray-800">{imp.stat}</span>
                        <span className="text-green-600 font-bold text-lg">{imp.change}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Highlights */}
              {finaleData?.highlights && (
                <div className="bg-gradient-to-br from-yellow-50 to-white p-6 rounded-xl border-2 border-yellow-200">
                  <h3 className="text-xl font-bold text-yellow-900 mb-4 flex items-center">
                    <span className="text-2xl mr-2">🏆</span>
                    Achievements
                  </h3>
                  <div className="space-y-2">
                    {finaleData.highlights.pentakills > 0 && (
                      <div className="flex justify-between py-1">
                        <span className="text-gray-700">Pentakills</span>
                        <span className="font-bold text-yellow-700">{finaleData.highlights.pentakills}</span>
                      </div>
                    )}
                    {finaleData.highlights.perfect_games > 0 && (
                      <div className="flex justify-between py-1">
                        <span className="text-gray-700">Perfect Games</span>
                        <span className="font-bold text-yellow-700">{finaleData.highlights.perfect_games}</span>
                      </div>
                    )}
                    {finaleData.highlights.first_bloods > 0 && (
                      <div className="flex justify-between py-1">
                        <span className="text-gray-700">First Bloods</span>
                        <span className="font-bold text-yellow-700">{finaleData.highlights.first_bloods}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1">
                      <span className="text-gray-700">Avg Vision Score</span>
                      <span className="font-bold text-yellow-700">{avgVision}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Top Champions */}
              {topChampions.length > 0 && (
                <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-xl border-2 border-blue-200">
                  <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center">
                    <span className="text-2xl mr-2">🎮</span>
                    Most Played Champions
                  </h3>
                  <div className="space-y-3">
                    {topChampions.map((champ, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b border-blue-100 last:border-0">
                        <div>
                          <div className="font-bold text-gray-900">{champ.name}</div>
                          <div className="text-sm text-gray-600">
                            {champ.avg_kda.toFixed(2)} KDA • {champ.win_rate.toFixed(0)}% WR
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-700">{champ.games}</div>
                          <div className="text-xs text-gray-600">games</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quarterly Progress */}
              <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-xl border-2 border-indigo-200">
                <h3 className="text-xl font-bold text-indigo-900 mb-4 flex items-center">
                  <span className="text-2xl mr-2">📅</span>
                  Quarterly Journey
                </h3>
                <div className="space-y-3">
                  {['Q1', 'Q2', 'Q3', 'Q4'].map((qKey) => {
                    const quarter = quarters[qKey];
                    if (!quarter) return null;
                    return (
                      <div key={qKey} className="bg-white p-3 rounded-lg border border-indigo-200">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-indigo-900">{qKey} - {quarter.region_arc || 'Runeterra'}</span>
                          <span className="text-sm text-gray-600">{quarter.stats.games} games</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">KDA:</span>
                            <span className="font-semibold text-gray-900 ml-1">{quarter.stats.kda_proxy.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">CS:</span>
                            <span className="font-semibold text-gray-900 ml-1">{quarter.stats.cs_per_min.toFixed(1)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Gold:</span>
                            <span className="font-semibold text-gray-900 ml-1">{quarter.stats.gold_per_min.toFixed(0)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Quarterly Narrative - The Journey Through Runeterra */}
          <div className="mb-8 page-break">
            <h2 className="text-2xl font-bold text-center mb-6 text-purple-900 border-b-2 border-purple-300 pb-3">
              📖 Your Journey Through Runeterra
            </h2>
            <div className="space-y-6">
              {['Q1', 'Q2', 'Q3', 'Q4'].map((qKey) => {
                const quarter = quarters[qKey];
                if (!quarter) return null;
                
                const bgColors = {
                  Q1: 'from-blue-50 to-blue-100',
                  Q2: 'from-green-50 to-green-100',
                  Q3: 'from-orange-50 to-orange-100',
                  Q4: 'from-purple-50 to-purple-100'
                };
                
                const borderColors = {
                  Q1: 'border-blue-300',
                  Q2: 'border-green-300',
                  Q3: 'border-orange-300',
                  Q4: 'border-purple-300'
                };
                
                return (
                  <div key={qKey} className={`bg-gradient-to-br ${bgColors[qKey as keyof typeof bgColors]} p-6 rounded-xl border-2 ${borderColors[qKey as keyof typeof borderColors]}`}>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-xl font-bold text-gray-900">
                        {qKey}: {quarter.region_arc || 'Runeterra'}
                      </h3>
                      <div className="text-sm text-gray-600">
                        {quarter.stats.games} games • {quarter.stats.kda_proxy.toFixed(2)} KDA
                      </div>
                    </div>
                    
                    {/* Lore */}
                    {quarter.lore && (
                      <div className="bg-white/80 backdrop-blur p-4 rounded-lg mb-3 italic text-gray-800 text-sm leading-relaxed">
                        "{quarter.lore}"
                      </div>
                    )}
                    
                    {/* Reflection */}
                    {quarter.reflection && (
                      <div className="bg-white/60 p-3 rounded-lg text-sm text-gray-700">
                        <span className="font-semibold">Reflection:</span> {quarter.reflection}
                      </div>
                    )}
                    
                    {/* Top Values for this quarter */}
                    <div className="mt-3 flex gap-2 flex-wrap">
                      {quarter.top_values?.slice(0, 3).map(([name, value]) => (
                        <span key={name} className="px-3 py-1 bg-white/80 rounded-full text-xs font-semibold text-gray-800">
                          {name}: {value.toFixed(0)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Performance Trends Analysis */}
          {finaleData?.trends && (
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-xl border-2 border-indigo-200 mb-8 page-break">
              <h3 className="text-xl font-bold text-indigo-900 mb-4 flex items-center">
                <span className="text-2xl mr-2">📈</span>
                Performance Trends Throughout 2025
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {finaleData.trends.kda_trend && (
                  <div className="bg-white p-4 rounded-lg border border-indigo-200">
                    <div className="text-sm text-gray-600 mb-1">KDA Trend</div>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-indigo-900">{finaleData.trends.kda_trend.direction === 'improving' ? '📈' : finaleData.trends.kda_trend.direction === 'declining' ? '📉' : '➡️'}</span>
                      <span className={`font-bold text-lg ${finaleData.trends.kda_trend.direction === 'improving' ? 'text-green-600' : finaleData.trends.kda_trend.direction === 'declining' ? 'text-red-600' : 'text-gray-600'}`}>
                        {finaleData.trends.kda_trend.change_percentage > 0 ? '+' : ''}{finaleData.trends.kda_trend.change_percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Best: {finaleData.trends.kda_trend.best_quarter}</div>
                  </div>
                )}
                
                {finaleData.trends.cs_trend && (
                  <div className="bg-white p-4 rounded-lg border border-indigo-200">
                    <div className="text-sm text-gray-600 mb-1">CS/min Trend</div>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-indigo-900">{finaleData.trends.cs_trend.direction === 'improving' ? '📈' : finaleData.trends.cs_trend.direction === 'declining' ? '📉' : '➡️'}</span>
                      <span className={`font-bold text-lg ${finaleData.trends.cs_trend.direction === 'improving' ? 'text-green-600' : finaleData.trends.cs_trend.direction === 'declining' ? 'text-red-600' : 'text-gray-600'}`}>
                        {finaleData.trends.cs_trend.change_percentage > 0 ? '+' : ''}{finaleData.trends.cs_trend.change_percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Best: {finaleData.trends.cs_trend.best_quarter}</div>
                  </div>
                )}
                
                {finaleData.trends.gold_trend && (
                  <div className="bg-white p-4 rounded-lg border border-indigo-200">
                    <div className="text-sm text-gray-600 mb-1">Gold/min Trend</div>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-indigo-900">{finaleData.trends.gold_trend.direction === 'improving' ? '📈' : finaleData.trends.gold_trend.direction === 'declining' ? '📉' : '➡️'}</span>
                      <span className={`font-bold text-lg ${finaleData.trends.gold_trend.direction === 'improving' ? 'text-green-600' : finaleData.trends.gold_trend.direction === 'declining' ? 'text-red-600' : 'text-gray-600'}`}>
                        {finaleData.trends.gold_trend.change_percentage > 0 ? '+' : ''}{finaleData.trends.gold_trend.change_percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Best: {finaleData.trends.gold_trend.best_quarter}</div>
                  </div>
                )}
                
                {finaleData.trends.vision_trend && (
                  <div className="bg-white p-4 rounded-lg border border-indigo-200">
                    <div className="text-sm text-gray-600 mb-1">Vision Trend</div>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-indigo-900">{finaleData.trends.vision_trend.direction === 'improving' ? '📈' : finaleData.trends.vision_trend.direction === 'declining' ? '📉' : '➡️'}</span>
                      <span className={`font-bold text-lg ${finaleData.trends.vision_trend.direction === 'improving' ? 'text-green-600' : finaleData.trends.vision_trend.direction === 'declining' ? 'text-red-600' : 'text-gray-600'}`}>
                        {finaleData.trends.vision_trend.change_percentage > 0 ? '+' : ''}{finaleData.trends.vision_trend.change_percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Best: {finaleData.trends.vision_trend.best_quarter}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Champion Pool Analysis */}
          {finaleData?.champion_analysis && (
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-6 rounded-xl border-2 border-amber-200 mb-8">
              <h3 className="text-xl font-bold text-amber-900 mb-4 flex items-center">
                <span className="text-2xl mr-2">🎯</span>
                Champion Pool Analysis
              </h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-white p-3 rounded-lg text-center border border-amber-200">
                  <div className="text-2xl font-bold text-amber-700">{totalChampions}</div>
                  <div className="text-xs text-gray-600">Unique Champions</div>
                </div>
                {finaleData.champion_analysis.versatility_score !== undefined && (
                  <div className="bg-white p-3 rounded-lg text-center border border-amber-200">
                    <div className="text-2xl font-bold text-amber-700">{finaleData.champion_analysis.versatility_score.toFixed(1)}</div>
                    <div className="text-xs text-gray-600">Versatility Score</div>
                  </div>
                )}
                {finaleData.champion_analysis.one_tricks && finaleData.champion_analysis.one_tricks.length > 0 && (
                  <div className="bg-white p-3 rounded-lg text-center border border-amber-200">
                    <div className="text-2xl font-bold text-amber-700">{finaleData.champion_analysis.one_tricks.length}</div>
                    <div className="text-xs text-gray-600">Main Champions</div>
                  </div>
                )}
              </div>
              {finaleData.champion_analysis.one_tricks && finaleData.champion_analysis.one_tricks.length > 0 && (
                <div className="bg-white p-3 rounded-lg border border-amber-200">
                  <div className="text-sm font-semibold text-gray-700 mb-2">Your Main Champions:</div>
                  <div className="flex gap-2 flex-wrap">
                    {finaleData.champion_analysis.one_tricks.map((champ, idx) => (
                      <span key={idx} className="px-3 py-1 bg-amber-100 rounded-full text-sm font-semibold text-amber-900">
                        {champ}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Finale Lore */}
          {finaleData?.lore && (
            <div className="bg-gradient-to-br from-slate-100 to-gray-100 p-8 rounded-xl border-2 border-slate-300 mb-8 page-break">
              <h3 className="text-2xl font-bold text-center text-slate-900 mb-4">
                ⚔️ The Legend of {riotId}
              </h3>
              <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed italic text-center">
                {finaleData.lore}
              </div>
            </div>
          )}

          {/* AI Insights */}
          {finaleData?.insights && finaleData.insights.length > 0 && (
            <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-white p-6 rounded-xl border-2 border-purple-200 mb-8">
              <h3 className="text-xl font-bold text-purple-900 mb-4 flex items-center">
                <span className="text-2xl mr-2">🤖</span>
                AI-Generated Insights
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {finaleData.insights.slice(0, 6).map((insight, idx) => {
                  // Convert priority to user-friendly labels
                  const priorityLabels: Record<string, { label: string; color: string; icon: string }> = {
                    'high': { label: 'Focus Area', color: 'text-red-700 bg-red-100 border-red-300', icon: '🎯' },
                    'medium': { label: 'Strength', color: 'text-blue-700 bg-blue-100 border-blue-300', icon: '💪' },
                    'info': { label: 'Fun Fact', color: 'text-purple-700 bg-purple-100 border-purple-300', icon: '✨' },
                    'low': { label: 'Note', color: 'text-gray-700 bg-gray-100 border-gray-300', icon: '📝' }
                  };
                  
                  const priority = insight.priority || 'info';
                  const config = priorityLabels[priority] || priorityLabels['info'];
                  
                  return (
                    <div key={idx} className="bg-white p-4 rounded-lg border border-purple-200">
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold mb-2 ${config.color} border`}>
                        <span>{config.icon}</span>
                        <span>{config.label}</span>
                      </div>
                      <p className="text-sm text-gray-700">{insight.insight}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Final Reflection */}
          {finaleData?.final_reflection && finaleData.final_reflection.length > 0 && (
            <div className="bg-gradient-to-r from-purple-100 to-pink-100 p-6 rounded-xl border-2 border-purple-300 mb-8">
              <h3 className="text-xl font-bold text-purple-900 mb-3 text-center">Year in Review</h3>
              <div className="space-y-2">
                {finaleData.final_reflection.map((reflection, idx) => (
                  <p key={idx} className="text-gray-800 italic text-center">• {reflection}</p>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="text-center pt-6 border-t-2 border-gray-200">
            <p className="text-sm text-gray-600">
              Generated by <span className="font-bold text-purple-600">Rift Rewind</span> • Powered by AWS & Generative AI
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          @page {
            size: A4;
            margin: 1cm;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          #shareable-report {
            page-break-inside: avoid;
          }
          
          .page-break {
            page-break-before: always;
          }
          
          /* Ensure gradients and colors print */
          .bg-gradient-to-br,
          .bg-gradient-to-r,
          .bg-gradient-to-l {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          /* Optimize text for printing */
          body {
            font-size: 10pt;
          }
          
          h1 { font-size: 24pt; }
          h2 { font-size: 18pt; }
          h3 { font-size: 14pt; }
        }
      `}</style>
    </motion.div>
  );
};

export default ShareableReport;
