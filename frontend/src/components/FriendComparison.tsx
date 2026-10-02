import { useEffect, useState, type ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Download,
  FileJson,
  Handshake,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Route,
  Scale,
  ShieldCheck,
  Sparkles,
  Swords,
  Upload,
} from 'lucide-react';
import {
  apiErrorMessage,
  createDuoJourney,
  getDuoJourney,
  getJobStatus,
  type CompleteJourney,
  type DuoJourney,
  type DuoWaypoint,
  type PlayerAgent,
} from '../api';

interface FriendComparisonProps {
  onBack: () => void;
}

interface UploadState {
  fileName: string;
  journey: CompleteJourney;
}

const agentTone = {
  'agent-a': {
    accent: '#22d3ee',
    border: 'border-cyan-400/35',
    background: 'bg-cyan-400/10',
    text: 'text-cyan-200',
    label: 'Agent A',
  },
  'agent-b': {
    accent: '#c084fc',
    border: 'border-purple-400/35',
    background: 'bg-purple-400/10',
    text: 'text-purple-200',
    label: 'Agent B',
  },
} as const;

function readJourneyFile(file: File): Promise<CompleteJourney> {
  return file.text().then(raw => {
    const data = JSON.parse(raw) as Partial<CompleteJourney>;
    if (data.type !== 'complete-journey' || !data.quarters || !data.finale || !data.metadata) {
      throw new Error('Choose a complete Rift Rewind journey export.');
    }
    return data as CompleteJourney;
  });
}

function UploadCard({
  agentId,
  upload,
  onUpload,
}: {
  agentId: 'agent-a' | 'agent-b';
  upload: UploadState | null;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const tone = agentTone[agentId];
  return (
    <label className={`group relative flex min-h-56 cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border ${tone.border} ${tone.background} p-6 transition hover:-translate-y-1 hover:border-opacity-80`}>
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-10 blur-3xl" style={{ background: tone.accent }} />
      <div className="relative">
        <div className={`mb-5 inline-flex items-center gap-2 rounded-full border ${tone.border} bg-black/25 px-3 py-1 text-xs uppercase tracking-[0.2em] ${tone.text}`}>
          <Bot size={14} /> {tone.label}
        </div>
        {upload ? (
          <>
            <h3 className="text-2xl font-semibold text-white">{upload.journey.metadata.playerName}</h3>
            <p className="mt-2 text-sm text-gray-400">{upload.journey.metadata.totalGames} games · {upload.journey.metadata.archetype}</p>
          </>
        ) : (
          <>
            <Upload className={`mb-4 ${tone.text}`} size={32} />
            <h3 className="text-xl font-semibold text-white">Upload a player journey</h3>
            <p className="mt-2 text-sm leading-6 text-gray-400">The agent will be crafted only from the insights and evidence in this export.</p>
          </>
        )}
      </div>
      <div className="relative mt-6 flex items-center gap-2 text-sm text-gray-300">
        <FileJson size={16} className={tone.text} />
        <span className="truncate">{upload?.fileName || 'Choose complete-journey.json'}</span>
      </div>
      <input type="file" accept="application/json,.json" onChange={onUpload} className="sr-only" />
    </label>
  );
}

function AgentDossier({ agent }: { agent: PlayerAgent }) {
  const tone = agentTone[agent.id];
  const download = () => {
    const blob = new Blob([agent.skill_markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${agent.skill_name}-SKILL.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <article className={`rounded-2xl border ${tone.border} bg-black/25 p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className={`mb-2 text-xs uppercase tracking-[0.24em] ${tone.text}`}>{tone.label} · {agent.home_region}</div>
          <h3 className="text-2xl font-semibold text-white">{agent.name}</h3>
          <p className="mt-1 text-gray-400">{agent.style} · {agent.role} · {agent.total_games} games</p>
        </div>
        <button onClick={download} className={`flex items-center gap-2 rounded-lg border ${tone.border} bg-black/30 px-3 py-2 text-sm ${tone.text}`}>
          <Download size={15} /> SKILL.md
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {agent.top_values.map(value => (
          <span key={value.name} className={`rounded-full border ${tone.border} ${tone.background} px-3 py-1 text-xs ${tone.text}`}>
            {value.name} {value.score.toFixed(1)}
          </span>
        ))}
      </div>

      <div className="mt-6 grid gap-5 text-sm sm:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-2 font-semibold text-gray-200"><Sparkles size={15} className={tone.text} /> Brings to the party</div>
          <ul className="space-y-2 text-gray-400">
            {agent.strengths.slice(0, 2).map(item => <li key={item}>• {item}</li>)}
          </ul>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 font-semibold text-gray-200"><ShieldCheck size={15} className={tone.text} /> Guards during conflict</div>
          <p className="leading-6 text-gray-400">{agent.non_negotiable}</p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-gray-300">
        <span className={`font-semibold ${tone.text}`}>Negotiation instinct:</span> {agent.negotiation_policy}.
      </div>
    </article>
  );
}

function DuoMap({ duo }: { duo: DuoJourney }) {
  const [selected, setSelected] = useState<DuoWaypoint>(duo.journey_map[0]);
  const [firstOrigin, secondOrigin] = duo.origins;
  const shared = duo.journey_map.map(item => item.coordinates);
  const routePath = shared.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const firstPath = `M ${firstOrigin.coordinates.x} ${firstOrigin.coordinates.y} L ${shared[0].x} ${shared[0].y}`;
  const secondPath = `M ${secondOrigin.coordinates.x} ${secondOrigin.coordinates.y} L ${shared[0].x} ${shared[0].y}`;

  return (
    <section className="overflow-hidden rounded-3xl border border-runeterra-gold/25 bg-black/30">
      <div className="grid lg:grid-cols-[1.4fr_0.9fr]">
        <div className="map-grid relative min-h-[430px] border-b border-runeterra-gold/15 p-4 lg:border-b-0 lg:border-r">
          <div className="absolute left-6 top-5 z-10">
            <div className="text-xs uppercase tracking-[0.24em] text-runeterra-gold">Negotiated route</div>
            <h2 className="mt-1 text-2xl font-semibold text-white">Two trails. One pact.</h2>
          </div>
          <svg viewBox="0 0 100 100" role="img" aria-label="Two player routes converging into a shared journey across Runeterra" className="h-[430px] w-full">
            <defs>
              <filter id="duo-glow"><feGaussianBlur stdDeviation="1.2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              <linearGradient id="shared-route" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#22d3ee" /><stop offset="0.5" stopColor="#c8aa6e" /><stop offset="1" stopColor="#c084fc" /></linearGradient>
            </defs>
            <path d={firstPath} stroke="#22d3ee" strokeWidth="1.3" strokeDasharray="3 2" fill="none" opacity="0.8" />
            <path d={secondPath} stroke="#c084fc" strokeWidth="1.3" strokeDasharray="3 2" fill="none" opacity="0.8" />
            <path d={routePath} stroke="url(#shared-route)" strokeWidth="2" fill="none" filter="url(#duo-glow)" />
            {duo.origins.map(origin => {
              const tone = agentTone[origin.agent_id];
              return (
                <g key={origin.agent_id}>
                  <circle cx={origin.coordinates.x} cy={origin.coordinates.y} r="4" fill="#010310" stroke={tone.accent} strokeWidth="1.2" />
                  <text x={origin.coordinates.x} y={origin.coordinates.y - 6} textAnchor="middle" fill={tone.accent} fontSize="3">{origin.region}</text>
                </g>
              );
            })}
            {duo.journey_map.map(point => (
              <g key={point.index} onClick={() => setSelected(point)} className="cursor-pointer">
                <circle cx={point.coordinates.x} cy={point.coordinates.y} r={selected.index === point.index ? 4.2 : 3.2} fill={selected.index === point.index ? '#f0e6d2' : '#010310'} stroke="#c8aa6e" strokeWidth="1.2" />
                <text x={point.coordinates.x} y={point.coordinates.y - 5.5} textAnchor="middle" fill="#f0e6d2" fontSize="3.1">{point.region}</text>
                <text x={point.coordinates.x} y={point.coordinates.y + 1.1} textAnchor="middle" fill="#010310" fontSize="2.4" fontWeight="700">{point.index}</text>
              </g>
            ))}
          </svg>
        </div>

        <motion.div key={selected.index} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="p-7 lg:p-9">
          <div className="text-xs uppercase tracking-[0.22em] text-runeterra-gold">Act {selected.index} · {selected.act}</div>
          <h3 className="mt-2 text-3xl font-semibold text-white">{selected.region}</h3>
          <p className="mt-2 text-sm italic text-gray-500">{selected.theme}</p>
          <p className="mt-6 leading-7 text-gray-300">{selected.why}</p>
          <div className="mt-6 space-y-3 text-sm">
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-cyan-100"><strong>{duo.agents[0].name}:</strong> {selected.agent_a_contribution}</div>
            <div className="rounded-xl border border-purple-400/20 bg-purple-400/5 p-3 text-purple-100"><strong>{duo.agents[1].name}:</strong> {selected.agent_b_contribution}</div>
          </div>
          <div className="mt-6 border-l-2 border-runeterra-gold pl-4 text-sm leading-6 text-runeterra-gold-light">
            <span className="font-semibold">Rule earned here:</span> {selected.negotiated_rule}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Negotiation({ duo }: { duo: DuoJourney }) {
  return (
    <section>
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-runeterra-gold">The campfire protocol</div>
          <h2 className="mt-2 text-3xl font-semibold text-white">Discussion becomes a pact</h2>
        </div>
        <div className="hidden items-center gap-2 text-xs text-gray-500 sm:flex"><MessageCircle size={15} /> {duo.negotiation.turns.length} grounded turns</div>
      </div>
      <div className="relative space-y-5 before:absolute before:bottom-4 before:left-1/2 before:top-4 before:w-px before:bg-gradient-to-b before:from-cyan-400/40 before:via-runeterra-gold/60 before:to-purple-400/40">
        {duo.negotiation.turns.map(turn => {
          const isA = turn.speaker_id === 'agent-a';
          const tone = agentTone[turn.speaker_id];
          return (
            <motion.article key={turn.turn} initial={{ opacity: 0, x: isA ? -20 : 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className={`relative grid grid-cols-[1fr_28px_1fr] items-center`}>
              <div className={isA ? 'col-start-1' : 'col-start-3'}>
                <div className={`rounded-2xl border ${tone.border} ${tone.background} p-5 ${isA ? 'text-right' : 'text-left'}`}>
                  <div className={`text-xs uppercase tracking-[0.2em] ${tone.text}`}>{turn.intent} · {turn.speaker_name}</div>
                  <p className="mt-3 leading-7 text-gray-200">{turn.message}</p>
                  <p className="mt-4 text-xs text-gray-500">Evidence: {turn.cited_evidence}</p>
                </div>
              </div>
              <div className="col-start-2 row-start-1 z-10 mx-auto flex h-7 w-7 items-center justify-center rounded-full border border-runeterra-gold/60 bg-runeterra-darker text-[10px] font-bold text-runeterra-gold">{turn.turn}</div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}

const FriendComparison: React.FC<FriendComparisonProps> = ({ onBack }) => {
  const [playerA, setPlayerA] = useState<UploadState | null>(null);
  const [playerB, setPlayerB] = useState<UploadState | null>(null);
  const [useLocalLlm, setUseLocalLlm] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [duo, setDuo] = useState<DuoJourney | null>(null);
  const [error, setError] = useState('');

  const upload = (slot: 'a' | 'b') => async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const journey = await readJourneyFile(file);
      const value = { fileName: file.name, journey };
      if (slot === 'a') setPlayerA(value);
      else setPlayerB(value);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Could not read that journey export.');
    }
  };

  const begin = async () => {
    if (!playerA || !playerB) return;
    setError('');
    setDuo(null);
    try {
      const job = await createDuoJourney(playerA.journey, playerB.journey, useLocalLlm);
      setJobId(job.jobId);
      setProgress(job.progress);
      setStage(job.stage);
    } catch (reason: unknown) {
      setError(apiErrorMessage(reason, 'The local agents could not begin their negotiation.'));
    }
  };

  useEffect(() => {
    if (!jobId || duo) return;
    let active = true;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const job = await getJobStatus(jobId);
        if (!active) return;
        setProgress(job.progress);
        setStage(job.stage);
        if (job.status === 'completed') {
          setDuo(await getDuoJourney(jobId));
          setJobId(null);
          return;
        }
        if (job.status === 'error') {
          setError(job.error || 'The negotiation failed.');
          setJobId(null);
          return;
        }
        timer = window.setTimeout(poll, 850);
      } catch (reason: unknown) {
        if (active) {
          setError(apiErrorMessage(reason, 'Lost contact with the local negotiation job.'));
          setJobId(null);
        }
      }
    };
    void poll();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [jobId, duo]);

  const reset = () => {
    setDuo(null);
    setJobId(null);
    setProgress(0);
    setStage('');
    setError('');
  };

  return (
    <main className="min-h-screen map-grid px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-7xl">
        <button onClick={onBack} className="mb-8 flex items-center gap-2 bg-transparent px-0 text-sm text-gray-400 hover:border-transparent hover:text-runeterra-gold">
          <ArrowLeft size={17} /> Back to solo journeys
        </button>

        {!duo && (
          <>
            <motion.header initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mb-10 max-w-4xl text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-runeterra-gold/30 bg-black/30 px-4 py-2 text-xs uppercase tracking-[0.24em] text-runeterra-gold">
                <Handshake size={15} /> Journey with a friend
              </div>
              <h1 className="text-4xl font-bold text-white md:text-6xl">Your data becomes two agents.<br /><span className="text-runeterra-gold">Their disagreement becomes the map.</span></h1>
              <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-gray-400">Each journey becomes a local player profile. A five-turn negotiation uses gameplay scores to build a shared Runeterra route.</p>
            </motion.header>

            <section className="grid gap-5 md:grid-cols-2">
              <UploadCard agentId="agent-a" upload={playerA} onUpload={upload('a')} />
              <UploadCard agentId="agent-b" upload={playerB} onUpload={upload('b')} />
            </section>

            <section className="mx-auto mt-8 max-w-4xl rounded-2xl border border-runeterra-gold/20 bg-runeterra-darker/80 p-6">
              <div className="grid gap-5 text-sm md:grid-cols-3">
                {[
                  { icon: Bot, title: 'Craft two agents', text: 'Build player profiles from gameplay scores, roles, and champions.' },
                  { icon: Scale, title: 'Negotiate the tension', text: 'Alternate proposals and concessions while every claim remains attached to evidence.' },
                  { icon: Route, title: 'Merge the paths', text: 'Turn the agreement into regions, responsibilities, checkpoints, and a shared pact.' },
                ].map(item => (
                  <div key={item.title} className="flex gap-3">
                    <item.icon className="mt-0.5 shrink-0 text-runeterra-gold" size={19} />
                    <div><h3 className="font-semibold text-gray-200">{item.title}</h3><p className="mt-1 leading-6 text-gray-500">{item.text}</p></div>
                  </div>
                ))}
              </div>

              {jobId ? (
                <div className="mt-7 rounded-xl border border-runeterra-gold/20 bg-black/30 p-5">
                  <div className="flex items-center justify-between gap-4 text-sm"><span className="flex items-center gap-2 text-runeterra-gold-light"><LoaderCircle className="animate-spin" size={17} /> {stage}</span><span className="text-runeterra-gold">{progress}%</span></div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5"><motion.div animate={{ width: `${progress}%` }} className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-runeterra-gold to-purple-400" /></div>
                </div>
              ) : (
                <div className="mt-7 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
                  <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-400">
                    <input type="checkbox" checked={useLocalLlm} onChange={event => setUseLocalLlm(event.target.checked)} className="mt-1 accent-amber-400" />
                    <span><strong className="block text-gray-200">Let Ollama voice the agents</strong>Turn this off for a fast deterministic negotiation.</span>
                  </label>
                  <button disabled={!playerA || !playerB} onClick={begin} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-runeterra-gold to-amber-200 px-6 py-3 font-semibold text-runeterra-darker disabled:cursor-not-allowed disabled:opacity-35">
                    <Swords size={18} /> Begin negotiation
                  </button>
                </div>
              )}
              {error && <p className="mt-5 rounded-lg border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
            </section>
          </>
        )}

        {duo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-14">
            <header className="relative overflow-hidden rounded-3xl border border-runeterra-gold/30 bg-gradient-to-br from-cyan-950/50 via-runeterra-darker to-purple-950/50 p-7 md:p-11">
              <div className="absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 rounded-full bg-runeterra-gold/10 blur-3xl" />
              <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
                <div className="max-w-4xl">
                  <div className="mb-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-runeterra-gold"><CheckCircle2 size={16} /> Pact reached · {duo.narrative.provider === 'ollama' ? `${duo.narrative.generated_sections} local-model turns` : 'deterministic dialogue'}</div>
                  <h1 className="text-4xl font-bold text-white md:text-6xl">{duo.negotiation.pact.title}</h1>
                  <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-300">{duo.story}</p>
                </div>
                <div className="shrink-0 rounded-2xl border border-runeterra-gold/25 bg-black/25 p-5 text-center">
                  <div className="text-5xl font-bold text-runeterra-gold">{duo.compatibility.score}%</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-400">{duo.compatibility.relationship}</div>
                </div>
              </div>
            </header>

            <section>
              <div className="mb-6"><div className="text-xs uppercase tracking-[0.24em] text-runeterra-gold">Agent dossiers</div><h2 className="mt-2 text-3xl font-semibold text-white">Two identities, kept intact</h2></div>
              <div className="grid gap-5 lg:grid-cols-2">{duo.agents.map(agent => <AgentDossier key={agent.id} agent={agent} />)}</div>
            </section>

            <Negotiation duo={duo} />

            <section className="rounded-3xl border border-runeterra-gold/30 bg-runeterra-gold/5 p-7 md:p-10">
              <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
                <div><div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-runeterra-gold"><Handshake size={16} /> Signed at the crossroads</div><h2 className="mt-3 text-3xl font-semibold text-white">{duo.negotiation.pact.title}</h2><p className="mt-4 leading-7 text-gray-300">{duo.negotiation.pact.shared_mission}</p></div>
                <div className="grid gap-3 sm:grid-cols-2">{duo.negotiation.pact.rules.map((rule, index) => <div key={rule} className="rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-gray-300"><span className="mr-2 text-runeterra-gold">0{index + 1}</span>{rule}</div>)}</div>
              </div>
              <div className="mt-7 flex items-start gap-3 border-t border-runeterra-gold/15 pt-6 text-sm leading-6 text-runeterra-gold-light"><ShieldCheck className="mt-0.5 shrink-0" size={18} /> <span><strong>Success signal:</strong> {duo.negotiation.pact.success_signal}</span></div>
            </section>

            <DuoMap duo={duo} />

            <div className="flex justify-center"><button onClick={reset} className="flex items-center gap-2 rounded-xl border border-runeterra-gold/30 bg-black/30 px-5 py-3 text-runeterra-gold-light"><RefreshCw size={17} /> Negotiate another journey</button></div>
          </motion.div>
        )}
      </div>
    </main>
  );
};

export default FriendComparison;
