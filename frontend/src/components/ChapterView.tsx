import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Compass, Shield, Sparkles, Swords } from 'lucide-react';
import type { Quarter } from '../api';
import { VALUE_DESCRIPTIONS } from '../constants/valueDescriptions';

const REGION_THEMES: Record<string, { gradient: string; accent: string; subtitle: string }> = {
  Noxus: { gradient: 'from-red-950/80 via-zinc-950 to-zinc-950', accent: 'text-red-300', subtitle: 'Strength is proven under pressure' },
  Demacia: { gradient: 'from-blue-950/80 via-zinc-950 to-zinc-950', accent: 'text-blue-200', subtitle: 'Discipline turns instinct into duty' },
  Freljord: { gradient: 'from-cyan-950/80 via-zinc-950 to-zinc-950', accent: 'text-cyan-200', subtitle: 'Endurance is a form of knowledge' },
  Piltover: { gradient: 'from-amber-950/70 via-zinc-950 to-zinc-950', accent: 'text-amber-200', subtitle: 'Refinement creates the next advantage' },
  Zaun: { gradient: 'from-lime-950/70 via-zinc-950 to-zinc-950', accent: 'text-lime-300', subtitle: 'Adaptation thrives where plans break' },
  Ionia: { gradient: 'from-violet-950/70 via-zinc-950 to-zinc-950', accent: 'text-violet-200', subtitle: 'Mastery begins with balance' },
  Bilgewater: { gradient: 'from-teal-950/80 via-zinc-950 to-zinc-950', accent: 'text-teal-200', subtitle: 'Every opening carries a price' },
  Shurima: { gradient: 'from-yellow-950/70 via-zinc-950 to-zinc-950', accent: 'text-yellow-200', subtitle: 'A fallen pattern can be rebuilt' },
  Targon: { gradient: 'from-indigo-950/80 via-zinc-950 to-zinc-950', accent: 'text-indigo-200', subtitle: 'Perspective is earned on the ascent' },
  'Shadow Isles': { gradient: 'from-purple-950/80 via-zinc-950 to-zinc-950', accent: 'text-purple-200', subtitle: 'The hardest lesson waits inside the loss' },
  Runeterra: { gradient: 'from-zinc-900 via-zinc-950 to-zinc-950', accent: 'text-runeterra-gold', subtitle: 'The route is written one match at a time' },
};

interface ChapterViewProps {
  quarter: string;
  data: Quarter;
  riotId: string;
  onNext: () => void;
  onMap: () => void;
  nextChapterReady?: boolean;
  nextChapterStatus?: string;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/25 p-4"><div className="text-xs uppercase tracking-wider text-gray-500">{label}</div><div className="mt-1 text-2xl font-bold text-runeterra-gold-light">{value}</div></div>;
}

export default function ChapterView({ data, riotId, onNext, onMap, nextChapterStatus }: ChapterViewProps) {
  const region = data.region_arc || 'Runeterra';
  const theme = REGION_THEMES[region] || REGION_THEMES.Runeterra;
  const stats = data.stats;

  return (
    <main className={`min-h-screen bg-gradient-to-br ${theme.gradient} px-4 py-8 md:px-8 md:py-12`}>
      <div className="mx-auto max-w-6xl">
        <nav className="mb-8 flex items-center justify-between">
          <button onClick={onMap} className="flex items-center gap-2 text-sm text-runeterra-gold-light/70 hover:text-runeterra-gold"><ArrowLeft size={17} /> Journey map</button>
          <div className="text-xs uppercase tracking-[0.24em] text-runeterra-gold/60">{riotId}</div>
        </nav>

        <header className="mb-8 text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-runeterra-gold">{data.act || data.quarter} · {data.date_range || data.quarter}</div>
          <h1 className={`mt-4 text-6xl font-bold md:text-8xl ${theme.accent}`}>{region}</h1>
          <p className="mt-3 text-lg text-gray-400">{theme.subtitle}</p>
        </header>

        <section className="mb-8 rounded-2xl border border-runeterra-gold/20 bg-black/30 p-6 backdrop-blur md:p-10">
          <div className="mb-5 flex items-center justify-center gap-3 text-runeterra-gold"><Sparkles size={19} /><h2 className="text-lg font-bold uppercase tracking-widest">The turning point</h2></div>
          <p className="mx-auto max-w-3xl text-center text-xl font-medium leading-relaxed text-runeterra-gold-light">{data.story_beat || data.journey_trigger}</p>
          {data.journey_trigger && data.story_beat !== data.journey_trigger && <p className="mx-auto mt-4 max-w-3xl text-center text-sm text-cyan-200/70">Route signal: {data.journey_trigger}</p>}
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <motion.article initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} className="rounded-2xl border border-white/10 bg-black/25 p-7 md:p-9">
            <div className="mb-5 flex items-center gap-3 text-runeterra-gold"><Compass size={20} /><h2 className="text-2xl font-bold">The chapter</h2></div>
            <p className="text-lg leading-8 text-runeterra-gold-light/90">{data.lore}</p>
          </motion.article>

          <motion.aside initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-7">
            <div className="mb-5 flex items-center gap-3 text-cyan-200"><Shield size={20} /><h2 className="text-xl font-bold">What the data says</h2></div>
            <ul className="space-y-4">
              {(data.evidence || []).map(item => <li key={item} className="border-l-2 border-cyan-400/50 pl-4 text-sm leading-relaxed text-gray-300">{item}</li>)}
            </ul>
            <div className="mt-6 rounded-lg bg-black/25 p-4 text-sm leading-relaxed text-cyan-100">{data.reflection}</div>
          </motion.aside>
        </section>

        <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
          <Metric label="Games" value={String(stats.games)} />
          <Metric label="Win rate" value={`${(stats.win_rate ?? 0).toFixed(0)}%`} />
          <Metric label="KDA" value={stats.kda_proxy.toFixed(2)} />
          <Metric label="CS/min" value={stats.cs_per_min.toFixed(1)} />
          <Metric label="Gold/min" value={stats.gold_per_min.toFixed(0)} />
          <Metric label="Vision/min" value={stats.vision_score_per_min.toFixed(2)} />
          <Metric label="Kill part." value={`${(stats.kill_participation ?? 0).toFixed(0)}%`} />
          <Metric label="Role" value={stats.primary_role || '—'} />
        </section>

        <section className="mb-10 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-runeterra-gold/20 bg-black/25 p-6">
            <div className="mb-4 flex items-center gap-2 text-runeterra-gold"><Swords size={19} /><h2 className="font-bold">Defining values</h2></div>
            <div className="space-y-4">
              {data.top_values.map(([name, score], index) => (
                <div key={name}>
                  <div className="mb-1 flex justify-between text-sm"><span className="font-medium text-runeterra-gold-light">{index + 1}. {name}</span><span className="text-runeterra-gold">{score.toFixed(1)}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-cyan-400 to-runeterra-gold" style={{ width: `${score}%` }} /></div>
                  <p className="mt-2 text-xs text-gray-500">{VALUE_DESCRIPTIONS[name]}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-runeterra-gold/20 bg-black/25 p-6">
            <h2 className="mb-4 font-bold text-runeterra-gold">Champions who traveled this road</h2>
            <div className="space-y-3">
              {(data.top_champions || []).map(champion => (
                <div key={champion.name} className="flex items-center justify-between rounded-lg bg-white/5 p-4">
                  <span className="font-semibold text-runeterra-gold-light">{champion.name}</span>
                  <span className="text-xs text-gray-400">{champion.games} games · {(champion.win_rate ?? 0).toFixed(0)}% wins</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="flex justify-center"><button onClick={onNext} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-runeterra-gold to-amber-200 px-7 py-4 font-bold text-runeterra-darker">{nextChapterStatus || 'Continue the journey'} <ArrowRight size={18} /></button></div>
      </div>
    </main>
  );
}
