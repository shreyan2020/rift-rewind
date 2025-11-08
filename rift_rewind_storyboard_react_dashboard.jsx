import React, { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, Legend } from "recharts";

// ---- Minimal UI bits (Tailwind) ----
const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl shadow-sm border border-zinc-800/40 bg-zinc-900/50 p-4 ${className}`}>{children}</div>
);
const H = ({ children, sub = false, className = "" }) => (
  <h2 className={`${sub ? "text-sm text-zinc-400" : "text-xl"} font-semibold ${className}`}>{children}</h2>
);
const Pill = ({ children }) => (
  <span className="inline-flex items-center rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">{children}</span>
);

// ---- Helpers ----
function fmtDate(ts) {
  try { return new Date(Number(ts)).toLocaleDateString(); } catch { return String(ts); }
}
function entries(obj) { return Object.entries(obj || {}); }
function safe(val, fallback = "–") { return (val ?? val === 0) ? val : fallback; }
function toRadarData(values) {
  return Object.keys(values || {}).map((k) => ({ axis: k, value: Number(values[k]) }));
}
function chapterLabel(ch) { return `Q${ch.quarter}`; }
function getValueKeys(json) {
  const v = json?.overall?.values || {}; return Object.keys(v);
}
function pct(x) { return (x * 100).toFixed(1) + "%"; }

// Collapse long arrays into small pretty lists
function TopList({ title, items, render, className = "" }) {
  return (
    <Card className={className}>
      <H>{title}</H>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {(items || []).map((it, i) => (
          <div key={i} className="rounded-xl bg-zinc-900/60 border border-zinc-800/50 p-3 text-sm">
            {render(it, i)}
          </div>
        ))}
      </div>
    </Card>
  );
}

function FileLoader({ onLoad }) {
  const [err, setErr] = useState(null);
  return (
    <Card>
      <H>Load story.json</H>
      <p className="text-sm text-zinc-400 mt-1">Drop your exported <code>story.json</code> or use the file picker. Everything runs client‑side.</p>
      <input
        type="file"
        accept=".json,application/json"
        className="mt-3 block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"
        onChange={async (e) => {
          setErr(null);
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const text = await f.text();
            const json = JSON.parse(text);
            onLoad(json);
          } catch (ex) {
            setErr(String(ex));
          }
        }}
      />
      {err && <p className="text-red-400 text-sm mt-2">{err}</p>}
    </Card>
  );
}

export default function RiftRewindDashboard() {
  const [data, setData] = useState(null);
  const [selKey, setSelKey] = useState(null);
  const [hoverQ, setHoverQ] = useState(null);

  const valueKeys = useMemo(() => (data ? getValueKeys(data) : []), [data]);
  const chapters = data?.chapters || [];

  const trajectoryData = useMemo(() => {
    if (!data) return [];
    const res = (data?.trajectories && selKey && data.trajectories[selKey]) ? data.trajectories[selKey].series : null;
    if (!res) return [];
    return res.map((v, idx) => ({ q: `Q${idx + 1}`, value: Number(v) }));
  }, [data, selKey]);

  const metaCard = data ? (
    <Card className="col-span-12 lg:col-span-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <H>Player</H>
          <div className="text-2xl font-bold mt-1">{safe(data.meta?.player)}</div>
          <div className="mt-2 flex gap-2"><Pill>{safe(data.meta?.archetype)}</Pill><Pill>{safe(data.meta?.matches)} matches</Pill></div>
        </div>
        <div className="text-right text-sm text-zinc-400">
          <div>Generated</div>
          <div className="font-medium text-zinc-200">{fmtDate((data.meta?.generated_at||0)*1000)}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="text-sm text-zinc-400">Top champions</div>
        <div className="col-span-2 grid grid-cols-3 gap-2">
          {(data.overall?.top_champions || []).slice(0,6).map((c,i)=> (
            <div key={i} className="rounded-xl bg-zinc-900/60 border border-zinc-800/50 p-3">
              <div className="font-semibold">{c.name}</div>
              <div className="text-xs text-zinc-400">Games: {c.games}</div>
              <div className="text-xs text-zinc-400">KDA proxy: {c.kda_proxy}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  ) : null;

  const radarCard = data ? (
    <Card className="col-span-12 lg:col-span-7">
      <div className="flex items-center justify-between">
        <H>Overall values profile (radar)</H>
        <div className="text-xs text-zinc-400">Higher is stronger alignment</div>
      </div>
      <div className="h-64 mt-2">
        <ResponsiveContainer>
          <RadarChart data={toRadarData(data.overall?.values)}>
            <PolarGrid />
            <PolarAngleAxis dataKey="axis" />
            <PolarRadiusAxis />
            <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  ) : null;

  const trajectoryCard = data ? (
    <Card className="col-span-12">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <H>Value trajectory across chapters</H>
        <select
          className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm"
          value={selKey || ""}
          onChange={(e)=>setSelKey(e.target.value || null)}
        >
          <option value="">Select a value…</option>
          {valueKeys.map((k)=> <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <div className="h-64 mt-3">
        <ResponsiveContainer>
          <LineChart data={trajectoryData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="q" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#22d3ee" dot />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  ) : null;

  const chaptersGrid = data ? (
    <div className="col-span-12 grid grid-cols-12 gap-4">
      {(chapters || []).map((ch, idx) => (
        <Card key={idx} className="col-span-12 lg:col-span-6 xl:col-span-3 hover:border-indigo-600/40 transition-colors" onMouseEnter={()=>setHoverQ(idx+1)} onMouseLeave={()=>setHoverQ(null)}>
          <div className="flex items-center justify-between">
            <H>Chapter {idx+1}</H>
            <Pill>{fmtDate(ch.time_range?.[0])} → {fmtDate(ch.time_range?.[1])}</Pill>
          </div>
          <div className="mt-2 text-sm text-zinc-400">Region: <span className="text-zinc-200 font-medium">{safe(ch.region_arc)}</span></div>

          <div className="mt-3">
            <H sub>Top values</H>
            <div className="mt-2 flex flex-wrap gap-2">
              {(ch.top_values || []).slice(0,4).map(([k,v],i)=> <Pill key={i}>{k}: {Number(v).toFixed(3)}</Pill>)}
            </div>
          </div>

          <div className="mt-3">
            <H sub>Top champions</H>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(ch.top_champions || []).map((c,i)=> (
                <div key={i} className="rounded-lg bg-zinc-900/60 border border-zinc-800/60 p-2">
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-zinc-400">Games: {c.games}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 h-40">
            <ResponsiveContainer>
              <BarChart data={[
                { k: "CS/min", v: ch.extensive_stats?.cs_per_min },
                { k: "Gold/min", v: ch.extensive_stats?.gold_per_min },
                { k: "Vision/min", v: ch.extensive_stats?.vision_score_per_min },
                { k: "KDA_proxy", v: ch.extensive_stats?.kda_proxy },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="k" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="v" fill="#a78bfa" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 text-sm text-zinc-300 line-clamp-5">
            {ch.lore || <span className="text-zinc-500 italic">Lore not generated for this chapter.</span>}
          </div>
        </Card>
      ))}
    </div>
  ) : null;

  const finaleCard = data ? (
    <Card className="col-span-12">
      <H>Finale</H>
      {data.finale?.lore ? (
        <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-200">{data.finale.lore}</div>
      ) : (
        <div className="mt-2 text-sm text-zinc-500 italic">Final lore not generated.</div>
      )}
      {(data.finale?.final_reflection && data.finale.final_reflection.length>0) && (
        <div className="mt-4">
          <H sub>Reflection</H>
          <ul className="mt-2 list-disc pl-5 text-sm text-zinc-300">
            {data.finale.final_reflection.map((x,i)=>(<li key={i}>{x}</li>))}
          </ul>
        </div>
      )}
    </Card>
  ) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Rift Rewind Storyboard</h1>
            <p className="text-zinc-400 text-sm">Interactive dashboard to explore chapters, values, champions, and stats.</p>
          </div>
          <div className="flex gap-2">
            <a href="#" onClick={(e)=>{e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' });}} className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm">Back to top</a>
          </div>
        </div>

        {!data && <FileLoader onLoad={setData} />}

        {data && (
          <>
            <div className="grid grid-cols-12 gap-4">
              {metaCard}
              {radarCard}
              {trajectoryCard}
            </div>

            <div className="mt-4 grid grid-cols-12 gap-4">
              {chaptersGrid}
              {finaleCard}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <div className="text-xs text-zinc-500">Hover a chapter card to focus the trajectory; select a value to plot.</div>
              <button
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold"
                onClick={()=>{ setData(null); setSelKey(null); setHoverQ(null); }}
              >Load another file</button>
            </div>
          </>
        )}

        <footer className="mt-12 text-xs text-zinc-500">
          Built for hackathons. Client‑side only. Deployable as a static app.
        </footer>
      </div>
    </div>
  );
}
