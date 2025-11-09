import { motion } from 'framer-motion';
import type { Quarter } from '../api';
import { VALUE_DESCRIPTIONS } from '../constants/valueDescriptions';

// Region-specific background themes
const REGION_THEMES: Record<string, { bg: string; accent: string; shadow: string; description: string }> = {
  'Demacia': {
    bg: 'from-blue-950 via-slate-900 to-blue-900',
    accent: 'from-blue-400 to-cyan-300',
    shadow: 'shadow-blue-500/30',
    description: 'The marble citadel of honor and justice'
  },
  'Noxus': {
    bg: 'from-red-950 via-slate-900 to-red-900',
    accent: 'from-red-500 to-orange-400',
    shadow: 'shadow-red-500/30',
    description: 'The crimson empire of strength and conquest'
  },
  'Ionia': {
    bg: 'from-pink-950 via-purple-900 to-indigo-900',
    accent: 'from-pink-400 to-purple-400',
    shadow: 'shadow-purple-500/30',
    description: 'The spiritual land of balance and harmony'
  },
  'Zaun': {
    bg: 'from-green-950 via-slate-900 to-emerald-900',
    accent: 'from-green-400 to-emerald-300',
    shadow: 'shadow-green-500/30',
    description: 'The undercity of innovation and chaos'
  },
  'Piltover': {
    bg: 'from-amber-950 via-slate-900 to-yellow-900',
    accent: 'from-amber-400 to-yellow-300',
    shadow: 'shadow-amber-500/30',
    description: 'The city of progress and enlightenment'
  },
  'Bilgewater': {
    bg: 'from-teal-950 via-slate-900 to-cyan-900',
    accent: 'from-teal-400 to-cyan-400',
    shadow: 'shadow-teal-500/30',
    description: 'The port city of pirates and plunder'
  },
  'Freljord': {
    bg: 'from-cyan-950 via-slate-900 to-blue-950',
    accent: 'from-cyan-300 to-blue-300',
    shadow: 'shadow-cyan-500/30',
    description: 'The frozen tundra of ancient traditions'
  },
  'Targon': {
    bg: 'from-indigo-950 via-slate-900 to-purple-950',
    accent: 'from-indigo-400 to-purple-400',
    shadow: 'shadow-indigo-500/30',
    description: 'The celestial peak of cosmic power'
  },
  'Shurima': {
    bg: 'from-yellow-950 via-slate-900 to-orange-900',
    accent: 'from-yellow-400 to-orange-400',
    shadow: 'shadow-yellow-500/30',
    description: 'The desert empire of ancient glory'
  },
  'Runeterra': {
    bg: 'from-slate-950 via-slate-900 to-slate-800',
    accent: 'from-slate-400 to-slate-300',
    shadow: 'shadow-slate-500/30',
    description: 'The vast world of magic and conflict'
  }
};

// Component definitions first
interface StatCardProps {
  label: string;
  value: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -5 }}
      className="bg-gradient-to-br from-runeterra-dark to-runeterra-darker border border-runeterra-gold/20 rounded-lg p-4 text-center"
    >
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <p className="text-runeterra-gold text-2xl font-bold">{value}</p>
    </motion.div>
  );
};

interface ValueBarProps {
  name: string;
  value: number;
  rank: number;
  delay: number;
}

const ValueBar: React.FC<ValueBarProps> = ({ name, value, rank, delay }) => {
  return (
    <div className="flex items-center gap-3">
      <span className="text-runeterra-gold font-bold w-6 text-sm">#{rank}</span>
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-runeterra-gold-light font-medium text-sm">{name}</span>
          <span className="text-gray-400 text-xs">{Number(value).toFixed(2)}</span>
        </div>
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-runeterra-blue to-runeterra-purple"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, (Number(value) + 1) * 50))}%` }}
            transition={{ delay, duration: 0.5 }}
          />
        </div>
      </div>
    </div>
  );
};

interface ChapterViewProps {
  quarter: string;
  data: Quarter;
  riotId: string;
  onNext?: () => void;
  nextChapterReady?: boolean;
  nextChapterStatus?: string;
}

const ChapterView: React.FC<ChapterViewProps> = ({ quarter, data, riotId, onNext, nextChapterReady, nextChapterStatus }) => {
  // Get region-specific theme
  const regionArc = data.region_arc || 'Runeterra';
  const theme = REGION_THEMES[regionArc] || REGION_THEMES['Runeterra'];
  
  return (
    <div className={`min-h-screen p-8 flex items-center justify-center bg-gradient-to-br ${theme.bg}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl w-full mx-auto"
      >
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-2"
          >
            <span className={`text-sm font-medium bg-gradient-to-r ${theme.accent} bg-clip-text text-transparent uppercase tracking-wider`}>
              {regionArc}
            </span>
            <p className="text-xs text-gray-400 italic mt-1">{theme.description}</p>
          </motion.div>
          <h1 className="text-6xl font-bold text-runeterra-gold mb-3 animate-glow">
            {quarter}
          </h1>
          <p className="text-runeterra-gold-light text-xl">{riotId}'s Journey Through Runeterra</p>
        </div>

        {/* Main Story Section - Centered and Prominent */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className={`bg-gradient-to-br from-black/60 to-black/40 backdrop-blur-sm border-2 border-runeterra-gold/50 rounded-xl p-12 mb-12 shadow-2xl ${theme.shadow}`}
        >
          <div className="flex items-center justify-center mb-6">
            <div className="h-px bg-runeterra-gold/30 flex-1"></div>
            <h2 className="text-3xl font-bold text-runeterra-gold px-6">Your Story</h2>
            <div className="h-px bg-runeterra-gold/30 flex-1"></div>
          </div>
          <p className="text-runeterra-gold-light text-xl leading-relaxed text-center whitespace-pre-wrap max-w-3xl mx-auto">
            {data.lore}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Stats Grid - Smaller, Side Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-runeterra-dark/50 backdrop-blur-sm border border-runeterra-gold/30 rounded-lg p-6"
          >
            <h3 className="text-xl font-bold text-runeterra-gold mb-4 text-center">Performance Stats</h3>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Games" value={data.stats.games.toString()} />
              <StatCard label="KDA" value={data.stats.kda_proxy.toFixed(2)} />
              <StatCard label="CS/min" value={data.stats.cs_per_min.toFixed(2)} />
              <StatCard label="Gold/min" value={data.stats.gold_per_min.toFixed(0)} />
              <StatCard label="Vision/min" value={data.stats.vision_score_per_min.toFixed(2)} />
              <StatCard label="Pings/min" value={data.stats.ping_rate_per_min.toFixed(2)} />
            </div>
          </motion.div>

          {/* Top Values - Side Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-runeterra-dark/50 backdrop-blur-sm border border-runeterra-blue/30 rounded-lg p-6"
          >
            <h3 className="text-xl font-bold text-runeterra-blue mb-4 text-center">Playstyle Values</h3>
            <div className="space-y-3 mb-4">
              {data.top_values.slice(0, 5).map(([name, value], index) => (
                <ValueBar key={name} name={name} value={value} rank={index + 1} delay={0.7 + index * 0.1} />
              ))}
            </div>
            {/* Value Descriptions Legend */}
            <div className="mt-6 pt-4 border-t border-runeterra-blue/20">
              <h4 className="text-xs font-semibold text-runeterra-blue/70 uppercase tracking-wider mb-3">What These Mean</h4>
              <div className="space-y-2">
                {data.top_values.slice(0, 5).map(([name]) => (
                  <div key={`desc-${name}`} className="text-xs">
                    <span className="font-semibold text-runeterra-gold-light">{name}:</span>
                    <span className="text-gray-400 ml-1">{VALUE_DESCRIPTIONS[name] || 'A measure of your playstyle.'}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Next Chapter Button */}
        {onNext && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="flex justify-center"
          >
            <motion.button
              onClick={onNext}
              disabled={!nextChapterReady}
              className={`
                px-8 py-4 rounded-lg font-bold text-lg transition-all
                ${nextChapterReady
                  ? 'bg-gradient-to-r from-runeterra-gold to-runeterra-gold-light text-runeterra-darker hover:shadow-lg hover:shadow-runeterra-gold/50'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }
              `}
              whileHover={nextChapterReady ? { scale: 1.05 } : {}}
              whileTap={nextChapterReady ? { scale: 0.95 } : {}}
            >
              {nextChapterReady ? '→ Continue to Next Chapter' : `⏳ ${nextChapterStatus}`}
            </motion.button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default ChapterView;
