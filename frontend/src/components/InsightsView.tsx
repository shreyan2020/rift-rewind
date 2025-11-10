import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Award, Brain } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface InsightsProps {
  insights: {
    insight: string;
    priority: string;
  }[];
  trends?: any;
  highlights?: any;
  championAnalysis?: any;
  yearSummary?: any;
  quarters?: any; // Add quarters data for date ranges
  onBack?: () => void;
}

const InsightsView: React.FC<InsightsProps> = ({
  insights,
  trends,
  highlights,
  championAnalysis,
  yearSummary,
  quarters,
  onBack
}) => {
  // Helper to get quarter date range
  const getQuarterDateRange = (quarterName: string) => {
    if (!quarters || !quarters[quarterName]) return quarterName;
    return quarters[quarterName].date_range || quarterName;
  };
  
  const priorityColors = {
    high: 'border-runeterra-gold/70 bg-runeterra-gold/20',
    medium: 'border-runeterra-gold/50 bg-runeterra-gold/10',
    low: 'border-runeterra-gold/30 bg-runeterra-gold/5',
    positive: 'border-runeterra-gold/50 bg-runeterra-gold/10',
    info: 'border-runeterra-gold-light/50 bg-runeterra-gold-light/10'
  };

  // Human-friendly descriptions for priority badges
  const priorityDescriptions: Record<string, string> = {
    high: 'Action needed — high impact on performance',
    medium: 'Worth attention — likely to improve outcomes',
    low: 'Low priority — optional improvements',
    positive: 'Positive insight — keep doing this',
    info: 'Informational — context or background'
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
    <div className="min-h-screen bg-gradient-to-b from-runeterra-dark via-runeterra-darker to-runeterra-dark py-12 px-4">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Back Button */}
        {onBack && (
          <motion.button
            onClick={onBack}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 text-runeterra-gold-light hover:text-runeterra-gold transition-colors"
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
            <h1 className="text-6xl font-bold text-runeterra-gold animate-glow">
              Your 2025 Journey
            </h1>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-8">
              <div className="bg-runeterra-darker/70 backdrop-blur-sm border border-runeterra-gold/30 rounded-xl p-6">
                <div className="text-4xl font-bold text-runeterra-gold">{yearSummary.total_games}</div>
                <div className="text-sm text-runeterra-gold-light mt-2">Total Games</div>
              </div>
              <div className="bg-runeterra-darker/70 backdrop-blur-sm border border-runeterra-gold/30 rounded-xl p-6">
                <div className="text-4xl font-bold text-runeterra-gold">{yearSummary.year_avg_kda}</div>
                <div className="text-sm text-runeterra-gold-light mt-2">Average KDA</div>
              </div>
              <div className="bg-runeterra-darker/70 backdrop-blur-sm border border-runeterra-gold/30 rounded-xl p-6">
                <div className="text-4xl font-bold text-runeterra-gold">{yearSummary.total_unique_champions}</div>
                <div className="text-sm text-runeterra-gold-light mt-2">Champions Played</div>
              </div>
            </div>

            {/* Achievements */}
            {yearSummary.achievements && yearSummary.achievements.length > 0 && (
              <div className="bg-gradient-to-r from-runeterra-gold/10 to-runeterra-gold/20 border border-runeterra-gold/30 rounded-xl p-6 mt-8">
                <h3 className="text-2xl font-bold text-runeterra-gold mb-4 flex items-center gap-2">
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
            <div>
              <h2 className="text-4xl font-bold text-runeterra-gold animate-glow mb-2">
                Your Growth Journey
              </h2>
              <p className="text-runeterra-gold-light text-sm">
                Your matches divided into 4 equal periods to track progression
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* KDA Trend */}
              {trends.kda && (
                <div className="bg-runeterra-darker/70 backdrop-blur-sm border border-runeterra-gold/30 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-runeterra-gold">KDA Progress</h3>
                    {trends.kda.direction === 'improving' ? (
                      <TrendingUp className="w-6 h-6 text-green-400" />
                    ) : trends.kda.direction === 'declining' ? (
                      <TrendingDown className="w-6 h-6 text-red-400" />
                    ) : null}
                  </div>
                  
                  {/* Mini Chart */}
                  <div className="h-24 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={[
                        { period: 'Early Season', label: getQuarterDateRange('Q1'), value: trends.kda.values[0] },
                        { period: 'Mid Season', label: getQuarterDateRange('Q2'), value: trends.kda.values[1] },
                        { period: 'Late Season', label: getQuarterDateRange('Q3'), value: trends.kda.values[2] },
                        { period: 'End of Season', label: getQuarterDateRange('Q4'), value: trends.kda.values[3] }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(200, 155, 60, 0.2)" />
                        <XAxis dataKey="period" stroke="#C89B3C" style={{ fontSize: '10px' }} />
                        <YAxis stroke="#C89B3C" style={{ fontSize: '12px' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0a1428',
                            border: '1px solid rgba(200, 155, 60, 0.5)',
                            borderRadius: '8px',
                            fontSize: '12px'
                          }}
                          formatter={(value: number) => value.toFixed(2)}
                          labelFormatter={(label: string, payload: readonly unknown[]) => {
                            if (payload && payload[0]) {
                              return (payload[0] as any).payload.label;
                            }
                            return label;
                          }}
                        />
                        <Line type="monotone" dataKey="value" stroke="#C89B3C" strokeWidth={2} dot={{ fill: '#C89B3C', r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-runeterra-gold">
                      {trends.kda.change_pct > 0 ? '+' : ''}{trends.kda.change_pct.toFixed(1)}%
                    </div>
                    <div className="text-sm text-runeterra-gold-light">
                      {trends.kda.direction === 'improving' ? 'Improving' : 
                       trends.kda.direction === 'declining' ? 'Needs Work' : 'Stable'}
                    </div>
                    <div className="text-xs text-gray-400">
                      vs Early Season baseline
                    </div>
                    <div className="text-xs text-runeterra-gold-light mt-1">
                      Best: {getQuarterDateRange(trends.kda.best_quarter)}
                    </div>
                  </div>
                </div>
              )}

              {/* CS Trend */}
              {trends.cs_per_min && (
                <div className="bg-runeterra-darker/70 backdrop-blur-sm border border-runeterra-gold/30 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-runeterra-gold">CS/min Progress</h3>
                    {trends.cs_per_min.direction === 'improving' ? (
                      <TrendingUp className="w-6 h-6 text-green-400" />
                    ) : trends.cs_per_min.direction === 'declining' ? (
                      <TrendingDown className="w-6 h-6 text-red-400" />
                    ) : null}
                  </div>
                  
                  {/* Mini Chart */}
                  <div className="h-24 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={[
                        { period: 'Early Season', label: getQuarterDateRange('Q1'), value: trends.cs_per_min.values[0] },
                        { period: 'Mid Season', label: getQuarterDateRange('Q2'), value: trends.cs_per_min.values[1] },
                        { period: 'Late Season', label: getQuarterDateRange('Q3'), value: trends.cs_per_min.values[2] },
                        { period: 'End of Season', label: getQuarterDateRange('Q4'), value: trends.cs_per_min.values[3] }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(200, 155, 60, 0.2)" />
                        <XAxis dataKey="period" stroke="#C89B3C" style={{ fontSize: '10px' }} />
                        <YAxis stroke="#C89B3C" style={{ fontSize: '12px' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0a1428',
                            border: '1px solid rgba(200, 155, 60, 0.5)',
                            borderRadius: '8px',
                            fontSize: '12px'
                          }}
                          formatter={(value: number) => value.toFixed(2)}
                          labelFormatter={(label: string, payload: readonly unknown[]) => {
                            if (payload && payload[0]) {
                              return (payload[0] as any).payload.label;
                            }
                            return label;
                          }}
                        />
                        <Line type="monotone" dataKey="value" stroke="#C89B3C" strokeWidth={2} dot={{ fill: '#C89B3C', r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-runeterra-gold">
                      {trends.cs_per_min.change_pct > 0 ? '+' : ''}{trends.cs_per_min.change_pct.toFixed(1)}%
                    </div>
                    <div className="text-sm text-runeterra-gold-light">
                      {trends.cs_per_min.direction === 'improving' ? 'Improving' : 
                       trends.cs_per_min.direction === 'declining' ? 'Needs Work' : 'Stable'}
                    </div>
                    <div className="text-xs text-gray-400">
                      vs Early Season baseline
                    </div>
                    <div className="text-xs text-runeterra-gold-light mt-1">
                      Best: {getQuarterDateRange(trends.cs_per_min.best_quarter)}
                    </div>
                  </div>
                </div>
              )}

              {/* Vision Trend */}
              {trends.vision_score && (
                <div className="bg-runeterra-darker/70 backdrop-blur-sm border border-runeterra-gold/30 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-runeterra-gold">Vision Score Progress</h3>
                    {trends.vision_score.direction === 'improving' ? (
                      <TrendingUp className="w-6 h-6 text-green-400" />
                    ) : trends.vision_score.direction === 'declining' ? (
                      <TrendingDown className="w-6 h-6 text-red-400" />
                    ) : null}
                  </div>
                  
                  {/* Mini Chart */}
                  <div className="h-24 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={[
                        { period: 'Early Season', label: getQuarterDateRange('Q1'), value: trends.vision_score.values[0] },
                        { period: 'Mid Season', label: getQuarterDateRange('Q2'), value: trends.vision_score.values[1] },
                        { period: 'Late Season', label: getQuarterDateRange('Q3'), value: trends.vision_score.values[2] },
                        { period: 'End of Season', label: getQuarterDateRange('Q4'), value: trends.vision_score.values[3] }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(200, 155, 60, 0.2)" />
                        <XAxis dataKey="period" stroke="#C89B3C" style={{ fontSize: '10px' }} />
                        <YAxis stroke="#C89B3C" style={{ fontSize: '12px' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0a1428',
                            border: '1px solid rgba(200, 155, 60, 0.5)',
                            borderRadius: '8px',
                            fontSize: '12px'
                          }}
                          formatter={(value: number) => value.toFixed(2)}
                          labelFormatter={(label: string, payload: readonly unknown[]) => {
                            if (payload && payload[0]) {
                              return (payload[0] as any).payload.label;
                            }
                            return label;
                          }}
                        />
                        <Line type="monotone" dataKey="value" stroke="#C89B3C" strokeWidth={2} dot={{ fill: '#C89B3C', r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-runeterra-gold">
                      {trends.vision_score.change_pct > 0 ? '+' : ''}{trends.vision_score.change_pct.toFixed(1)}%
                    </div>
                    <div className="text-sm text-runeterra-gold-light">
                      {trends.vision_score.direction === 'improving' ? 'Improving' : 
                       trends.vision_score.direction === 'declining' ? 'Needs Work' : 'Stable'}
                    </div>
                    <div className="text-xs text-gray-400">
                      vs Early Season baseline
                    </div>
                    <div className="text-xs text-runeterra-gold-light mt-1">
                      Best: {getQuarterDateRange(trends.vision_score.best_quarter)}
                    </div>
                  </div>
                </div>
              )}

              {/* Gold/min Trend */}
              {trends.gold_per_min && (
                <div className="bg-runeterra-darker/70 backdrop-blur-sm border border-runeterra-gold/30 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-runeterra-gold">Gold/min Progress</h3>
                    {trends.gold_per_min.direction === 'improving' ? (
                      <TrendingUp className="w-6 h-6 text-green-400" />
                    ) : trends.gold_per_min.direction === 'declining' ? (
                      <TrendingDown className="w-6 h-6 text-red-400" />
                    ) : null}
                  </div>
                  
                  {/* Mini Chart */}
                  <div className="h-24 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={[
                        { period: 'Early Season', label: getQuarterDateRange('Q1'), value: trends.gold_per_min.values[0] },
                        { period: 'Mid Season', label: getQuarterDateRange('Q2'), value: trends.gold_per_min.values[1] },
                        { period: 'Late Season', label: getQuarterDateRange('Q3'), value: trends.gold_per_min.values[2] },
                        { period: 'End of Season', label: getQuarterDateRange('Q4'), value: trends.gold_per_min.values[3] }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(200, 155, 60, 0.2)" />
                        <XAxis dataKey="period" stroke="#C89B3C" style={{ fontSize: '10px' }} />
                        <YAxis stroke="#C89B3C" style={{ fontSize: '12px' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0a1428',
                            border: '1px solid rgba(200, 155, 60, 0.5)',
                            borderRadius: '8px',
                            fontSize: '12px'
                          }}
                          formatter={(value: number) => value.toFixed(1)}
                          labelFormatter={(label: string, payload: readonly unknown[]) => {
                            if (payload && payload[0]) {
                              return (payload[0] as any).payload.label;
                            }
                            return label;
                          }}
                        />
                        <Line type="monotone" dataKey="value" stroke="#C89B3C" strokeWidth={2} dot={{ fill: '#C89B3C', r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-runeterra-gold">
                      {trends.gold_per_min.change_pct > 0 ? '+' : ''}{trends.gold_per_min.change_pct.toFixed(1)}%
                    </div>
                    <div className="text-sm text-runeterra-gold-light">
                      {trends.gold_per_min.direction === 'improving' ? 'Improving' : 
                       trends.gold_per_min.direction === 'declining' ? 'Needs Work' : 'Stable'}
                    </div>
                    <div className="text-xs text-gray-400">
                      vs Early Season baseline
                    </div>
                    <div className="text-xs text-runeterra-gold-light mt-1">
                      Best: {getQuarterDateRange(trends.gold_per_min.best_quarter)}
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
            <h2 className="text-4xl font-bold text-runeterra-gold animate-glow">
              Best Moments
            </h2>
            
            <div className="grid md:grid-cols-3 gap-6">
              {highlights.best_kda_game && (
                <div className="bg-gradient-to-br from-runeterra-gold/10 to-runeterra-gold/20 border border-runeterra-gold/30 rounded-xl p-6">
                  <div className="text-runeterra-gold font-bold text-sm mb-2">🏆 BEST KDA</div>
                  <div className="text-3xl font-bold text-runeterra-gold mb-2">
                    {highlights.best_kda_game.value?.toFixed(1) || 'N/A'}
                  </div>
                  <div className="text-runeterra-gold-light text-sm">
                    {highlights.best_kda_game.champion}
                  </div>
                </div>
              )}

              {highlights.most_kills_game && (
                <div className="bg-gradient-to-br from-runeterra-gold/10 to-runeterra-gold/20 border border-runeterra-gold/30 rounded-xl p-6">
                  <div className="text-runeterra-gold font-bold text-sm mb-2">⚔️ MOST KILLS</div>
                  <div className="text-3xl font-bold text-runeterra-gold mb-2">
                    {highlights.most_kills_game.kills?.toFixed(0) || 'N/A'}
                  </div>
                  <div className="text-runeterra-gold-light text-sm">
                    {highlights.most_kills_game.champion}
                  </div>
                </div>
              )}

              {highlights.most_damage_game && (
                <div className="bg-gradient-to-br from-runeterra-gold/10 to-runeterra-gold/20 border border-runeterra-gold/30 rounded-xl p-6">
                  <div className="text-runeterra-gold font-bold text-sm mb-2">💥 MOST DAMAGE</div>
                  <div className="text-3xl font-bold text-runeterra-gold mb-2">
                    {typeof highlights.most_damage_game.damage === 'number'
                      ? `${(highlights.most_damage_game.damage)}k`
                      : 'N/A'}
                  </div>
                  <div className="text-runeterra-gold-light text-sm">
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
            <h2 className="text-4xl font-bold text-runeterra-gold animate-glow">
              Champion Mastery
            </h2>
            
            <div className="grid md:grid-cols-5 gap-4">
              {championAnalysis.most_played?.slice(0, 5).map((champ: any, idx: number) => (
                <div key={idx} className="bg-runeterra-darker/70 backdrop-blur-sm border border-runeterra-gold/30 rounded-xl p-4">
                  <div className="text-xl font-bold text-runeterra-gold mb-2">{champ.name}</div>
                  <div className="space-y-1 text-sm">
                    <div className="text-runeterra-gold-light">{champ.games} games</div>
                    <div className="text-runeterra-gold-light">{champ.avg_cs_per_min?.toFixed(1)} CS/min</div>
                    <div className="text-runeterra-gold-light">
                      {typeof champ.avg_damage === 'number'
                        ? `${(champ.avg_damage / 1000).toFixed(2)}k dmg`
                        : 'N/A'}
                    </div>
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
                      <div className="flex items-center gap-3">
                        <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${priorityColors[insight.priority as keyof typeof priorityColors] || 'border-runeterra-gold/30 bg-runeterra-gold/5'}`}>
                          {insight.priority}
                        </div>
                        <div className="text-xs text-gray-400">{priorityDescriptions[insight.priority] || 'Priority note'}</div>
                      </div>
                      <div className="text-white font-semibold mt-2">{insight.insight}</div>
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
              <div className="bg-gradient-to-br from-runeterra-gold/10 to-runeterra-gold/20 border border-runeterra-gold/30 rounded-xl p-6">
                <h3 className="text-2xl font-bold text-runeterra-gold mb-4">✨ Your Strengths</h3>
                <ul className="space-y-3">
                  {yearSummary.strengths.map((strength: string, idx: number) => (
                    <li key={idx} className="text-runeterra-gold-light flex items-start gap-2">
                      <span className="text-runeterra-gold mt-1">•</span>
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Growth Areas */}
            {yearSummary.growth_areas && yearSummary.growth_areas.length > 0 && (
              <div className="bg-gradient-to-br from-runeterra-gold/10 to-runeterra-gold/20 border border-runeterra-gold/30 rounded-xl p-6">
                <h3 className="text-2xl font-bold text-runeterra-gold mb-4">🎯 Focus Areas</h3>
                <ul className="space-y-3">
                  {yearSummary.growth_areas.map((area: string, idx: number) => (
                    <li key={idx} className="text-runeterra-gold-light flex items-start gap-2">
                      <span className="text-runeterra-gold mt-1">•</span>
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
