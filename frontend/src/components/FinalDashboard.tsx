import { motion } from 'framer-motion';
import { useState, useMemo } from 'react';
import type { Quarter, Finale } from '../api';
import { VALUE_DESCRIPTIONS } from '../constants/valueDescriptions';
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface FinalDashboardProps {
  quarters: Record<string, Quarter>;
  riotId: string;
  finaleData: Finale | null;
  onNewJourney?: () => void;
}

const FinalDashboard: React.FC<FinalDashboardProps> = ({ quarters, riotId, finaleData, onNewJourney }) => {
  const quarterKeys = useMemo(() => ['Q1', 'Q2', 'Q3', 'Q4'], []);

  // State for selected value in dropdown
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  
  // Get all unique values from all quarters for dropdown
  const allValueNames = useMemo(() => {
    const valueSet = new Set<string>();
    Object.values(quarters).forEach(q => {
      Object.keys(q.values || {}).forEach(key => valueSet.add(key));
    });
    return Array.from(valueSet).sort();
  }, [quarters]);
  
  // Get top 4 values across all quarters (by average)
  const topValues = useMemo(() => {
    const valueAverages: Record<string, number> = {};
    
    Object.values(quarters).forEach(q => {
      Object.entries(q.values || {}).forEach(([name, value]) => {
        if (!valueAverages[name]) valueAverages[name] = 0;
        valueAverages[name] += value;
      });
    });
    
    // Calculate averages and get top 4
    return Object.entries(valueAverages)
      .map(([name, sum]) => ({ name, avg: sum / 4 }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 4)
      .map(v => v.name);
  }, [quarters]);

  // Set initial selected value to first top value
  React.useEffect(() => {
    if (!selectedValue && topValues.length > 0) {
      setSelectedValue(topValues[0]);
    }
  }, [topValues, selectedValue]);
  
  // Calculate average stats across all quarters
  const avgStats = {
    games: 0,
    kda_proxy: 0,
    cs_per_min: 0,
    gold_per_min: 0,
    vision_score_per_min: 0,
    ping_rate_per_min: 0,
  };
  
  quarterKeys.forEach(qKey => {
    const q = quarters[qKey];
    if (q && q.stats) {
      avgStats.games += q.stats.games;
      avgStats.kda_proxy += q.stats.kda_proxy;
      avgStats.cs_per_min += q.stats.cs_per_min;
      avgStats.gold_per_min += q.stats.gold_per_min;
      avgStats.vision_score_per_min += q.stats.vision_score_per_min;
      avgStats.ping_rate_per_min += q.stats.ping_rate_per_min;
    }
  });
  
  // Average non-game stats
  avgStats.kda_proxy /= 4;
  avgStats.cs_per_min /= 4;
  avgStats.gold_per_min /= 4;
  avgStats.vision_score_per_min /= 4;
  avgStats.ping_rate_per_min /= 4;
  
  // Use finale lore if available, otherwise fallback
  const finalLore = finaleData?.lore || `Your journey through Runeterra comes to a close. From the first steps in Q1 to the final battles of Q4, you've carved a unique path across the Rift. The data reveals not just numbers, but a story of growth, adaptation, and perseverance. As the season ends, your legend in Runeterra is etched into the annals of the Rift. What will your next chapter hold?`;
  
  // Use finale reflection if available, otherwise consolidate quarter reflections
  const consolidatedReflection = finaleData?.final_reflection || quarterKeys
    .map(qKey => quarters[qKey]?.reflection)
    .filter(Boolean);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-7xl font-bold text-runeterra-gold mb-4 animate-glow">
            Journey Complete
          </h1>
          <p className="text-runeterra-gold-light text-2xl mb-2">{riotId}'s 2025 Season</p>
          <p className="text-gray-400 text-lg">Your legend across Runeterra</p>
        </motion.div>

        {/* Final Lore */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-runeterra-dark/70 to-runeterra-darker/70 backdrop-blur-sm border-2 border-runeterra-gold/50 rounded-xl p-12 mb-12 shadow-2xl shadow-runeterra-gold/20"
        >
          <div className="flex items-center justify-center mb-6">
            <div className="h-px bg-runeterra-gold/30 flex-1"></div>
            <h2 className="text-3xl font-bold text-runeterra-gold px-6">The Final Chapter</h2>
            <div className="h-px bg-runeterra-gold/30 flex-1"></div>
          </div>
          <p className="text-runeterra-gold-light text-xl leading-relaxed text-center max-w-4xl mx-auto">
            {finalLore}
          </p>
        </motion.div>

        {/* Season Stats Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-runeterra-dark/50 backdrop-blur-sm border border-runeterra-gold/30 rounded-lg p-8 mb-12"
        >
          <h3 className="text-2xl font-bold text-runeterra-gold mb-6 text-center">Season 2025 Stats</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="Total Games" value={avgStats.games.toString()} />
            <StatCard label="Avg KDA" value={avgStats.kda_proxy.toFixed(2)} />
            <StatCard label="Avg CS/min" value={avgStats.cs_per_min.toFixed(2)} />
            <StatCard label="Avg Gold/min" value={avgStats.gold_per_min.toFixed(0)} />
            <StatCard label="Avg Vision/min" value={avgStats.vision_score_per_min.toFixed(2)} />
            <StatCard label="Avg Pings/min" value={avgStats.ping_rate_per_min.toFixed(2)} />
          </div>
        </motion.div>

        {/* Playstyle Evolution Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-runeterra-dark/50 backdrop-blur-md rounded-2xl border border-runeterra-gold/20 p-8 mb-12"
        >
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <h3 className="text-2xl font-bold text-runeterra-gold flex items-center gap-3">
              <span className="text-3xl">📈</span>
              Playstyle Evolution
            </h3>
            <div className="flex items-center gap-3">
              <label className="text-runeterra-gold-light text-sm font-medium">
                Select Value:
              </label>
              <select
                value={selectedValue || ''}
                onChange={(e) => setSelectedValue(e.target.value)}
                className="px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-600 text-zinc-100 text-sm focus:outline-none focus:border-cyan-400 transition-colors"
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
            <TimelineChart selectedValue={selectedValue} quarters={quarters} quarterKeys={quarterKeys} />
          ) : (
            <div className="text-center text-runeterra-gold-light/50 py-16">
              Select a value to view its progression
            </div>
          )}
        </motion.div>

        {/* Final Reflection & Tips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-gradient-to-br from-runeterra-dark/40 to-runeterra-purple/10 backdrop-blur-sm border border-runeterra-purple/30 rounded-lg p-8 mb-12"
        >
          <h3 className="text-2xl font-bold text-runeterra-purple mb-4 text-center">Growth & Reflection</h3>
          {Array.isArray(consolidatedReflection) ? (
            <ul className="text-runeterra-gold-light text-base leading-relaxed max-w-4xl mx-auto space-y-3">
              {consolidatedReflection.map((reflection, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="text-runeterra-purple text-xl mt-0.5">•</span>
                  <span>{reflection}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-runeterra-gold-light text-base leading-relaxed text-center max-w-4xl mx-auto">
              {consolidatedReflection}
            </p>
          )}
        </motion.div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center"
        >
          <p className="text-runeterra-gold-light text-lg mb-4">
            Your journey through Runeterra has been recorded.
          </p>
          <p className="text-gray-400 mb-6">
            Keep climbing, Summoner. The Rift awaits your return.
          </p>
          
          {onNewJourney && (
            <motion.button
              onClick={onNewJourney}
              className="px-8 py-4 rounded-lg font-bold text-lg bg-gradient-to-r from-runeterra-gold to-runeterra-gold-light text-runeterra-darker hover:shadow-lg hover:shadow-runeterra-gold/50 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              🔍 Analyze Another Summoner
            </motion.button>
          )}
        </motion.div>
      </div>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -5 }}
      className="bg-gradient-to-br from-runeterra-dark to-runeterra-darker border border-runeterra-gold/20 rounded-lg p-6 text-center"
    >
      <p className="text-gray-400 text-sm mb-2">{label}</p>
      <p className="text-runeterra-gold text-3xl font-bold">{value}</p>
    </motion.div>
  );
};

interface TimelineChartProps {
  selectedValue: string;
  quarters: Record<string, Quarter>;
  quarterKeys: string[];
}

const TimelineChart: React.FC<TimelineChartProps> = ({ selectedValue, quarters, quarterKeys }) => {
  // Values are already scaled to 0-100 in the backend
  const values = quarterKeys.map(qKey => quarters[qKey]?.values?.[selectedValue] ?? 50);
  
  // Prepare data for Recharts
  const chartData = quarterKeys.map((qKey, idx) => ({
    quarter: qKey,
    value: values[idx],
  }));

  // Calculate change stats
  const change = values[3] - values[0];
  const absoluteChange = Math.abs(change);
  const percentChange = values[0] !== 0 ? (change / values[0]) * 100 : 0;
  
  // For display
  const displayMetric = absoluteChange < 1 
    ? 'Stable'
    : Math.abs(percentChange) >= 5
      ? `${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%`
      : `${change > 0 ? '+' : ''}${change.toFixed(1)} pts`;

  // Custom tooltip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-lg">
          <p className="text-cyan-400 font-bold text-sm">{payload[0].payload.quarter}</p>
          <p className="text-zinc-300 text-sm">{payload[0].value.toFixed(1)}/100</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Recharts Line Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.3)" />
            <XAxis 
              dataKey="quarter" 
              stroke="#22d3ee"
              style={{ fontSize: '12px', fontWeight: 'bold' }}
            />
            <YAxis 
              stroke="#9ca3af"
              style={{ fontSize: '11px' }}
            />
            <Tooltip 
              content={<CustomTooltip />}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#22d3ee" 
              strokeWidth={2}
              dot={{ fill: '#22d3ee', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Trend Summary for selected value */}
      <div className="flex justify-center">
        <ValueTooltipWrapper valueName={selectedValue}>
          <motion.div
            key={selectedValue} // Re-animate when value changes
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 text-center cursor-help max-w-sm shadow-lg"
          >
            <div className="w-4 h-4 rounded-full mx-auto mb-3 bg-cyan-400"></div>
            <div className="text-cyan-400 text-lg font-bold mb-2">
              {selectedValue}
            </div>
            <div className={`text-4xl font-bold mb-2 ${
              absoluteChange < 1 ? 'text-gray-400' : 
              change > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {absoluteChange < 1 ? '→' : change > 0 ? '↗' : '↘'}
              {' '}
              {displayMetric}
            </div>
            <div className="text-sm text-zinc-400">
              Q1: {values[0].toFixed(1)}/100 → Q4: {values[3].toFixed(1)}/100
            </div>
            <div className="text-xs text-zinc-300 mt-3 max-w-xs mx-auto">
              {VALUE_DESCRIPTIONS[selectedValue]}
            </div>
          </motion.div>
        </ValueTooltipWrapper>
      </div>
    </div>
  );
};interface ValueTooltipWrapperProps {
  valueName: string;
  children: React.ReactNode;
}

const ValueTooltipWrapper: React.FC<ValueTooltipWrapperProps> = ({ valueName, children }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      {showTooltip && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute left-0 right-0 top-full mt-2 z-10 bg-runeterra-darker border border-runeterra-blue/50 rounded-lg p-3 shadow-xl"
        >
          <p className="text-runeterra-gold-light text-xs leading-relaxed">
            {VALUE_DESCRIPTIONS[valueName] || 'A measure of your playstyle.'}
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default FinalDashboard;
