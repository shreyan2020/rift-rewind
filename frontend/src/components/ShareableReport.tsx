import { motion } from 'framer-motion';
import type { Finale, Quarter } from '../api';

interface ShareableReportProps {
  quarters: Record<string, Quarter>;
  riotId: string;
  finaleData: Finale | null;
  onClose: () => void;
}

export default function ShareableReport({ quarters, riotId, finaleData, onClose }: ShareableReportProps) {
  const ordered = ['Q1', 'Q2', 'Q3', 'Q4'].map(key => quarters[key]).filter(Boolean);
  const totals: Record<string, number> = {};
  for (const quarter of ordered) {
    for (const [name, value] of Object.entries(quarter.values)) totals[name] = (totals[name] || 0) + value;
  }
  const topValues = Object.entries(totals).map(([name, value]) => ({ name, value: value / Math.max(1, ordered.length) })).sort((a, b) => b.value - a.value).slice(0, 5);
  const summary = finaleData?.year_summary;
  const champions = finaleData?.champion_analysis?.top_champions || finaleData?.champion_analysis?.most_played || [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 overflow-y-auto bg-black/90 p-4 backdrop-blur print:static print:bg-white print:p-0">
      <div className="mx-auto mb-10 max-w-5xl overflow-hidden rounded-2xl bg-[#f6f0e2] text-slate-900 shadow-2xl print:mb-0 print:max-w-none print:rounded-none print:shadow-none">
        <div className="flex justify-end gap-2 border-b border-amber-900/15 p-4 print:hidden">
          <button onClick={onClose} className="rounded-lg bg-slate-800 px-4 py-2 text-white">Close</button>
          <button onClick={() => window.print()} className="rounded-lg bg-amber-700 px-4 py-2 font-semibold text-white">Print / Save PDF</button>
        </div>

        <article className="p-8 md:p-12">
          <header className="border-b-2 border-amber-700/30 pb-8 text-center">
            <div className="text-xs font-bold uppercase tracking-[0.35em] text-amber-800">Rift Rewind · Local Journey Record</div>
            <h1 className="mt-4 text-4xl font-black text-slate-950 md:text-6xl">{finaleData?.season_title || 'A Path Across Runeterra'}</h1>
            <p className="mt-3 text-xl text-slate-600">{riotId}</p>
          </header>

          <section className="my-8 grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ['Games', String(summary?.total_games || ordered.reduce((total, q) => total + q.stats.games, 0))],
              ['Win rate', `${(summary?.win_rate || 0).toFixed(0)}%`],
              ['KDA', (summary?.year_avg_kda || 0).toFixed(2)],
              ['Champions', String(summary?.total_unique_champions || 0)],
              ['Trajectory', summary?.overall_trend || 'stable'],
            ].map(([label, value]) => <div key={label} className="rounded-lg border border-amber-900/15 bg-white/50 p-4 text-center"><div className="text-2xl font-black text-amber-800">{value}</div><div className="mt-1 text-xs uppercase tracking-wider text-slate-500">{label}</div></div>)}
          </section>

          <section className="mb-10 rounded-xl border border-amber-800/20 bg-white/45 p-7">
            <h2 className="mb-3 text-2xl font-black text-amber-900">The final chapter</h2>
            <p className="leading-7 text-slate-700">{finaleData?.lore}</p>
          </section>

          <section className="mb-10">
            <h2 className="mb-5 text-2xl font-black text-slate-900">The route</h2>
            <div className="grid gap-4 md:grid-cols-4">
              {ordered.map(quarter => (
                <div key={quarter.quarter} className="rounded-xl border border-slate-300 bg-white/60 p-5">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-800">{quarter.act || quarter.quarter}</div>
                  <h3 className="mt-2 text-xl font-black">{quarter.region_arc}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{quarter.story_beat || quarter.journey_trigger}</p>
                  <div className="mt-3 text-xs text-slate-400">{quarter.date_range}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-10 grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="mb-4 text-2xl font-black">Defining values</h2>
              <div className="space-y-3">{topValues.map(value => <div key={value.name}><div className="mb-1 flex justify-between text-sm font-semibold"><span>{value.name}</span><span>{value.value.toFixed(1)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-amber-700" style={{ width: `${value.value}%` }} /></div></div>)}</div>
            </div>
            <div>
              <h2 className="mb-4 text-2xl font-black">Most traveled champions</h2>
              <div className="space-y-2">{champions.slice(0, 5).map(champion => <div key={champion.name} className="flex justify-between rounded-lg border border-slate-200 bg-white/60 p-3"><span className="font-bold">{champion.name}</span><span className="text-sm text-slate-500">{champion.games} games · {champion.win_rate.toFixed(0)}%</span></div>)}</div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-black">Insights carried forward</h2>
            <div className="space-y-3">{(finaleData?.insights || []).map((insight, index) => <div key={`${insight.category}-${index}`} className="rounded-lg border-l-4 border-amber-700 bg-white/55 p-4"><div className="text-xs font-bold uppercase tracking-wider text-amber-800">{insight.category} · {insight.priority}</div><p className="mt-1 font-semibold">{insight.insight}</p>{insight.evidence && <p className="mt-1 text-sm text-slate-500">Evidence: {insight.evidence}</p>}{insight.action && <p className="mt-2 text-sm text-slate-700">Next move: {insight.action}</p>}</div>)}</div>
          </section>

          <footer className="border-t border-amber-900/20 pt-5 text-center text-xs text-slate-500">Generated locally from match statistics and gameplay heuristics.</footer>
        </article>
      </div>
    </motion.div>
  );
}
