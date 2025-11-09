import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Award, Brain } from 'lucide-react';

interface InsightsProps {
  insights: {
    insight: string;
    priority: string;
  }[];
  trends?: any;
  highlights?: any;
  championAnalysis?: any;
  yearSummary?: any;
  onBack?: () => void;
}

const InsightsView: React.FC<InsightsProps> = ({
  insights,
  trends,
  highlights,
  championAnalysis,
  yearSummary,
  onBack
}) => {
  const priorityColors = {
    high: 'border-red-500/50 bg-red-500/10',
    medium: 'border-yellow-500/50 bg-yellow-500/10',
    low: 'border-blue-500/50 bg-blue-500/10',
    positive: 'border-green-500/50 bg-green-500/10',
    info: 'border-purple-500/50 bg-purple-500/10'
  };

  // const categoryIcons = {
  //   'Combat': Target,
  //   'Farming': Zap,
  //   'Vision': Shield,
  //   'Progress': TrendingUp,
  //   'Champion Pool': Users,
  //   'Champion Mastery': Award,
  //   'Role': Brain
  // };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900 py-12 px-4">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Back Button */}
        {onBack && (
          <motion.button
            onClick={onBack}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            whileHover={{ x: -5 }}
          >
            <span className="text-2xl">←</span>
            <span>Back to Summary</span>
          </motion.button>
        )}
        
        {/* Year Summary Header */}
        {yearSummary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-6"
          >
            <h1 className="text-6xl font-bold bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
              Your 2025 Journey
            </h1>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
              <div className="bg-black/40 backdrop-blur-sm border border-yellow-500/30 rounded-xl p-6">
                <div className="text-4xl font-bold text-yellow-400">{yearSummary.total_games}</div>
                <div className="text-sm text-gray-400 mt-2">Total Games</div>
              </div>
              <div className="bg-black/40 backdrop-blur-sm border border-green-500/30 rounded-xl p-6">
                <div className="text-4xl font-bold text-green-400">{yearSummary.year_avg_kda}</div>
                <div className="text-sm text-gray-400 mt-2">Average KDA</div>
              </div>
              <div className="bg-black/40 backdrop-blur-sm border border-blue-500/30 rounded-xl p-6">
                <div className="text-4xl font-bold text-blue-400">{yearSummary.total_unique_champions}</div>
                <div className="text-sm text-gray-400 mt-2">Champions Played</div>
              </div>
              <div className="bg-black/40 backdrop-blur-sm border border-purple-500/30 rounded-xl p-6">
                <div className="text-4xl font-bold text-purple-400">{yearSummary.comeback_victories}</div>
                <div className="text-sm text-gray-400 mt-2">Comebacks</div>
              </div>
            </div>

            {/* Achievements */}
            {yearSummary.achievements && yearSummary.achievements.length > 0 && (
              <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl p-6 mt-8">
                <h3 className="text-2xl font-bold text-yellow-400 mb-4 flex items-center gap-2">
                  <Award className="w-6 h-6" />
                  Your Achievements
                </h3>
                <div className="flex flex-wrap gap-3 justify-center">
                  {yearSummary.achievements.map((achievement: string, idx: number) => (
                    <div key={idx} className="bg-black/60 px-4 py-2 rounded-lg text-yellow-300 font-semibold">
                      {achievement}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Trends Section */}
        {trends && trends.available && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              Your Growth Journey
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* KDA Trend */}
              {trends.kda && (
                <div className="bg-black/40 backdrop-blur-sm border border-blue-500/30 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-blue-400">KDA Progress</h3>
                    {trends.kda.direction === 'improving' ? (
                      <TrendingUp className="w-6 h-6 text-green-400" />
                    ) : trends.kda.direction === 'declining' ? (
                      <TrendingDown className="w-6 h-6 text-red-400" />
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-white">
                      {trends.kda.change_pct > 0 ? '+' : ''}{trends.kda.change_pct.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-400">
                      {trends.kda.direction === 'improving' ? 'Improving' : 
                       trends.kda.direction === 'declining' ? 'Needs Work' : 'Stable'}
                    </div>
                    <div className="text-xs text-gray-500">
                      Best quarter: {trends.kda.best_quarter}
                    </div>
                  </div>
                </div>
              )}

              {/* CS Trend */}
              {trends.cs_per_min && (
                <div className="bg-black/40 backdrop-blur-sm border border-green-500/30 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-green-400">CS/min Progress</h3>
                    {trends.cs_per_min.direction === 'improving' ? (
                      <TrendingUp className="w-6 h-6 text-green-400" />
                    ) : trends.cs_per_min.direction === 'declining' ? (
                      <TrendingDown className="w-6 h-6 text-red-400" />
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-white">
                      {trends.cs_per_min.change_pct > 0 ? '+' : ''}{trends.cs_per_min.change_pct.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-400">
                      {trends.cs_per_min.direction === 'improving' ? 'Improving' : 
                       trends.cs_per_min.direction === 'declining' ? 'Needs Work' : 'Stable'}
                    </div>
                    <div className="text-xs text-gray-500">
                      Best quarter: {trends.cs_per_min.best_quarter}
                    </div>
                  </div>
                </div>
              )}

              {/* Vision Trend */}
              {trends.vision_score && (
                <div className="bg-black/40 backdrop-blur-sm border border-purple-500/30 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-purple-400">Vision Score Progress</h3>
                    {trends.vision_score.direction === 'improving' ? (
                      <TrendingUp className="w-6 h-6 text-green-400" />
                    ) : trends.vision_score.direction === 'declining' ? (
                      <TrendingDown className="w-6 h-6 text-red-400" />
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-white">
                      {trends.vision_score.change_pct > 0 ? '+' : ''}{trends.vision_score.change_pct.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-400">
                      {trends.vision_score.direction === 'improving' ? 'Improving' : 
                       trends.vision_score.direction === 'declining' ? 'Needs Work' : 'Stable'}
                    </div>
                    <div className="text-xs text-gray-500">
                      Best quarter: {trends.vision_score.best_quarter}
                    </div>
                  </div>
                </div>
              )}

              {/* Gold/min Trend */}
              {trends.gold_per_min && (
                <div className="bg-black/40 backdrop-blur-sm border border-yellow-500/30 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-yellow-400">Gold/min Progress</h3>
                    {trends.gold_per_min.direction === 'improving' ? (
                      <TrendingUp className="w-6 h-6 text-green-400" />
                    ) : trends.gold_per_min.direction === 'declining' ? (
                      <TrendingDown className="w-6 h-6 text-red-400" />
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-white">
                      {trends.gold_per_min.change_pct > 0 ? '+' : ''}{trends.gold_per_min.change_pct.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-400">
                      {trends.gold_per_min.direction === 'improving' ? 'Improving' : 
                       trends.gold_per_min.direction === 'declining' ? 'Needs Work' : 'Stable'}
                    </div>
                    <div className="text-xs text-gray-500">
                      Best quarter: {trends.gold_per_min.best_quarter}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Highlights Section */}
        {highlights && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-6"
          >
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
              Best Moments
            </h2>
            
            <div className="grid md:grid-cols-3 gap-6">
              {highlights.best_kda_game && (
                <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl p-6">
                  <div className="text-yellow-400 font-bold text-sm mb-2">🏆 BEST KDA</div>
                  <div className="text-3xl font-bold text-white mb-2">
                    {highlights.best_kda_game.value?.toFixed(1) || 'N/A'}
                  </div>
                  <div className="text-gray-400 text-sm">
                    {highlights.best_kda_game.champion}
                  </div>
                </div>
              )}

              {highlights.most_kills_game && (
                <div className="bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/30 rounded-xl p-6">
                  <div className="text-red-400 font-bold text-sm mb-2">⚔️ MOST KILLS</div>
                  <div className="text-3xl font-bold text-white mb-2">
                    {highlights.most_kills_game.kills?.toFixed(0) || 'N/A'}
                  </div>
                  <div className="text-gray-400 text-sm">
                    {highlights.most_kills_game.champion}
                  </div>
                </div>
              )}

              {highlights.most_damage_game && (
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-6">
                  <div className="text-purple-400 font-bold text-sm mb-2">💥 MOST DAMAGE</div>
                  <div className="text-3xl font-bold text-white mb-2">
                    {(highlights.most_damage_game.damage / 1000).toFixed(1)}k
                  </div>
                  <div className="text-gray-400 text-sm">
                    {highlights.most_damage_game.champion}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Champion Pool Section */}
        {championAnalysis && championAnalysis.available && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-6"
          >
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-500">
              Champion Mastery
            </h2>
            
            <div className="grid md:grid-cols-5 gap-4">
              {championAnalysis.most_played?.slice(0, 5).map((champ: any, idx: number) => (
                <div key={idx} className="bg-black/40 backdrop-blur-sm border border-pink-500/30 rounded-xl p-4">
                  <div className="text-xl font-bold text-pink-400 mb-2">{champ.name}</div>
                  <div className="space-y-1 text-sm">
                    <div className="text-gray-400">{champ.games} games</div>
                    <div className="text-gray-400">{champ.avg_cs_per_min?.toFixed(1)} CS/min</div>
                    <div className="text-gray-400">{(champ.avg_damage / 1000).toFixed(1)}k dmg</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Actionable Insights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-6"
        >
          <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">
            Actionable Insights
          </h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            {insights?.map((insight, idx) => {
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + idx * 0.1 }}
                  className={`border rounded-xl p-6 ${priorityColors[insight.priority as keyof typeof priorityColors] || priorityColors.info}`}
                >
                  <div className="flex items-start gap-4">
                    <Brain className="w-6 h-6 mt-1 flex-shrink-0" />
                    <div className="space-y-2">
                      <div className="font-bold text-sm text-gray-400">{insight.priority.toUpperCase()}</div>
                      <div className="text-white font-semibold">{insight.insight}</div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Strengths & Growth Areas */}
        {yearSummary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="grid md:grid-cols-2 gap-6"
          >
            {/* Strengths */}
            {yearSummary.strengths && yearSummary.strengths.length > 0 && (
              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-6">
                <h3 className="text-2xl font-bold text-green-400 mb-4">✨ Your Strengths</h3>
                <ul className="space-y-3">
                  {yearSummary.strengths.map((strength: string, idx: number) => (
                    <li key={idx} className="text-gray-300 flex items-start gap-2">
                      <span className="text-green-400 mt-1">•</span>
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Growth Areas */}
            {yearSummary.growth_areas && yearSummary.growth_areas.length > 0 && (
              <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-xl p-6">
                <h3 className="text-2xl font-bold text-orange-400 mb-4">🎯 Focus Areas</h3>
                <ul className="space-y-3">
                  {yearSummary.growth_areas.map((area: string, idx: number) => (
                    <li key={idx} className="text-gray-300 flex items-start gap-2">
                      <span className="text-orange-400 mt-1">•</span>
                      <span>{area}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default InsightsView;
