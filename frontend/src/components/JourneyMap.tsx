import { motion } from 'framer-motion';
import { ArrowRight, Compass, Sparkles } from 'lucide-react';
import type { JourneyWaypoint, Quarter } from '../api';

interface JourneyMapProps {
  route: JourneyWaypoint[];
  quarters: Record<string, Quarter>;
  playerName: string;
  seasonTitle?: string;
  onSelect: (quarter: string) => void;
  onFinale: () => void;
}

const FALLBACK_COORDINATES = [
  { x: 18, y: 68 }, { x: 42, y: 30 }, { x: 70, y: 64 }, { x: 86, y: 28 },
];

export default function JourneyMap({ route, quarters, playerName, seasonTitle, onSelect, onFinale }: JourneyMapProps) {
  const points = route.map((waypoint, index) => waypoint.coordinates || FALLBACK_COORDINATES[index]);
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');

  return (
    <main className="min-h-screen map-grid px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-runeterra-gold"><Compass size={15} /> Expedition chart</div>
            <h1 className="text-4xl font-bold text-runeterra-gold md:text-6xl">{seasonTitle || 'A Path Across Runeterra'}</h1>
            <p className="mt-3 text-runeterra-gold-light/70">{playerName}'s season, mapped as four data-driven turning points.</p>
          </div>
          <button onClick={onFinale} className="inline-flex items-center justify-center gap-2 rounded-lg border border-runeterra-gold/40 bg-runeterra-gold/10 px-5 py-3 text-runeterra-gold-light hover:bg-runeterra-gold/20">
            Season conclusion <ArrowRight size={17} />
          </button>
        </header>

        <section className="relative mb-8 overflow-hidden rounded-3xl border border-runeterra-gold/25 bg-[#050817]/95 shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(10,200,185,0.12),transparent_35%),radial-gradient(circle_at_72%_68%,rgba(200,170,110,0.12),transparent_35%)]" />
          <svg viewBox="0 0 100 100" role="img" aria-label="Four-stop Runeterra journey route" className="relative h-[420px] w-full md:h-[560px]">
            <defs>
              <filter id="route-glow"><feGaussianBlur stdDeviation="1.2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              <linearGradient id="route-line" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#0ac8b9" /><stop offset="1" stopColor="#c8aa6e" /></linearGradient>
            </defs>
            <path d="M 3 38 C 18 15, 32 10, 47 22 S 75 20, 95 36 L 92 76 C 70 88, 46 91, 19 79 Z" fill="#10172c" stroke="#25304c" strokeWidth="0.45" />
            <path d="M 8 42 C 25 32, 36 38, 48 50 S 69 63, 92 55" fill="none" stroke="#1b2540" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
            <motion.path d={path} fill="none" stroke="url(#route-line)" strokeWidth="1.15" strokeDasharray="2.2 1.3" filter="url(#route-glow)" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.8, ease: 'easeInOut' }} />
            {route.map((waypoint, index) => {
              const point = points[index];
              return (
                <g key={waypoint.quarter} onClick={() => onSelect(waypoint.quarter)} className="cursor-pointer" role="button" tabIndex={0}>
                  <motion.circle cx={point.x} cy={point.y} r="4.2" fill="#050817" stroke={index === 2 ? '#a855f7' : '#c8aa6e'} strokeWidth="0.8" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.35 + index * 0.25 }} />
                  <circle cx={point.x} cy={point.y} r="1.4" fill={index === 2 ? '#a855f7' : '#0ac8b9'} />
                  <text x={point.x} y={point.y - 6.5} textAnchor="middle" fill="#f0e6d2" fontSize="2.8" fontWeight="700">{waypoint.region}</text>
                  <text x={point.x} y={point.y + 7.3} textAnchor="middle" fill="#c8aa6e" fontSize="2.1">ACT {index + 1}</text>
                </g>
              );
            })}
          </svg>
          <div className="absolute bottom-5 left-5 max-w-sm rounded-xl border border-white/10 bg-black/55 p-4 backdrop-blur">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-runeterra-gold"><Sparkles size={15} /> Why this route?</div>
            <p className="text-xs leading-relaxed text-gray-400">Each stop comes from a dominant trait or a measurable change between equal chronological match periods. The model writes the prose; your data chooses the road.</p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-4">
          {route.map((waypoint, index) => {
            const quarter = quarters[waypoint.quarter];
            return (
              <motion.button key={waypoint.quarter} onClick={() => onSelect(waypoint.quarter)} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="rounded-2xl border border-runeterra-gold/20 bg-runeterra-dark/75 p-5 text-left hover:-translate-y-1 hover:border-runeterra-gold/60">
                <div className="text-xs uppercase tracking-[0.2em] text-runeterra-gold/70">{waypoint.act}</div>
                <h2 className="mt-2 text-2xl font-bold text-runeterra-gold-light">{waypoint.region}</h2>
                <p className="mt-2 min-h-16 text-sm leading-relaxed text-gray-400">{waypoint.trigger}</p>
                <div className="mt-4 border-t border-white/10 pt-3 text-xs text-cyan-200">{quarter?.date_range || waypoint.quarter}</div>
              </motion.button>
            );
          })}
        </section>
      </div>
    </main>
  );
}
