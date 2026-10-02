import { useState } from 'react';
import { motion } from 'framer-motion';
import { Cpu, Database, Map, Swords, Upload } from 'lucide-react';
import {
  createJourney,
  createJourneyFromUpload,
  apiErrorMessage,
  type CompleteJourney,
  type JourneyRequest,
} from './api';
import Journey from './components/Journey';
import FriendComparison from './components/FriendComparison';

type Mode = 'riot' | 'upload' | 'compare';

const previousYear = new Date().getFullYear() - 1;

function App() {
  const [mode, setMode] = useState<Mode>('riot');
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploadedJourney, setUploadedJourney] = useState<CompleteJourney | null>(null);
  const [uploadPayload, setUploadPayload] = useState<unknown>(null);
  const [uploadName, setUploadName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<JourneyRequest>({
    platform: 'euw1',
    riotId: '',
    archetype: 'explorer',
    year: previousYear,
    queue: 420,
    maxMatches: 200,
    useLocalLlm: true,
  });

  const startRiotJourney = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const job = await createJourney(form);
      setJobId(job.jobId);
    } catch (reason: unknown) {
      setError(apiErrorMessage(reason, 'The local API could not start the journey.'));
      setIsLoading(false);
    }
  };

  const readUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const data = JSON.parse(await file.text());
      setUploadName(file.name);
      if (data.type === 'complete-journey' && data.quarters && data.finale) {
        setUploadedJourney(data as CompleteJourney);
        setUploadPayload(null);
        setForm(current => ({
          ...current,
          riotId: data.metadata?.playerName || current.riotId,
          archetype: data.metadata?.archetype || current.archetype,
          year: data.metadata?.year || current.year,
        }));
      } else {
        setUploadedJourney(null);
        setUploadPayload(data);
      }
    } catch {
      setUploadPayload(null);
      setUploadedJourney(null);
      setError('That file is not valid JSON.');
    }
  };

  const startUploadedJourney = async (event: React.FormEvent) => {
    event.preventDefault();
    if (uploadedJourney) {
      setJobId('uploaded-journey');
      return;
    }
    if (!uploadPayload) {
      setError('Choose a match-data JSON file first.');
      return;
    }
    if (!form.riotId.trim()) {
      setError('Enter the player name that belongs to this dataset.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const job = await createJourneyFromUpload({
        playerName: form.riotId,
        archetype: form.archetype,
        year: form.year,
        useLocalLlm: form.useLocalLlm,
        payload: uploadPayload,
      });
      setJobId(job.jobId);
    } catch (reason: unknown) {
      setError(apiErrorMessage(reason, 'The local API could not read the dataset.'));
      setIsLoading(false);
    }
  };

  const reset = () => {
    setJobId(null);
    setUploadedJourney(null);
    setUploadPayload(null);
    setUploadName('');
    setIsLoading(false);
    setError('');
  };

  if (jobId) {
    return (
      <Journey
        jobId={jobId}
        riotId={form.riotId}
        onReset={reset}
        uploadedJourneyData={uploadedJourney || undefined}
      />
    );
  }

  if (mode === 'compare') {
    return <FriendComparison onBack={() => setMode('riot')} />;
  }

  return (
    <main className="min-h-screen map-grid px-4 py-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <motion.header initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-runeterra-gold/30 bg-black/30 px-4 py-2 text-xs uppercase tracking-[0.28em] text-runeterra-gold">
            <Cpu size={14} /> Local-first · private by default
          </div>
          <h1 className="text-5xl font-bold text-runeterra-gold md:text-7xl">Rift Rewind</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-runeterra-gold-light/80">
            Turn a ranked season into a four-act expedition across Runeterra—grounded in your data, narrated by your local model.
          </p>
        </motion.header>

        <section className="mb-8 grid gap-3 md:grid-cols-3">
          {[
            { id: 'riot' as const, icon: Swords, label: 'Riot ID', note: 'Fetch ranked matches locally' },
            { id: 'upload' as const, icon: Upload, label: 'Local data', note: 'Analyze an existing JSON dataset' },
            { id: 'compare' as const, icon: Map, label: 'Journey together', note: 'Let two player agents negotiate' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setMode(item.id)}
              className={`rounded-xl border p-4 text-left transition ${mode === item.id ? 'border-runeterra-gold bg-runeterra-gold/15' : 'border-runeterra-gold/20 bg-black/25 hover:border-runeterra-gold/50'}`}
            >
              <item.icon className="mb-3 text-runeterra-gold" size={22} />
              <span className="block font-semibold text-runeterra-gold-light">{item.label}</span>
              <span className="mt-1 block text-sm text-gray-400">{item.note}</span>
            </button>
          ))}
        </section>

        <motion.section layout className="mx-auto max-w-2xl rounded-2xl border border-runeterra-gold/25 bg-runeterra-darker/85 p-6 shadow-2xl backdrop-blur md:p-9">
          <form onSubmit={mode === 'riot' ? startRiotJourney : startUploadedJourney} className="space-y-6">
            {mode === 'upload' && (
              <label className="block rounded-xl border border-dashed border-runeterra-gold/40 bg-runeterra-gold/5 p-6 text-center transition hover:bg-runeterra-gold/10">
                <Database className="mx-auto mb-3 text-runeterra-gold" />
                <span className="block font-semibold text-runeterra-gold-light">{uploadName || 'Choose match data or a journey export'}</span>
                <span className="mt-1 block text-sm text-gray-400">JSON array, matches object, Q1–Q4 object, or complete journey</span>
                <input type="file" accept="application/json,.json" onChange={readUpload} className="sr-only" />
              </label>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-runeterra-gold-light">{mode === 'riot' ? 'Riot ID' : 'Player name'}</label>
              <input
                value={form.riotId}
                onChange={event => setForm({ ...form, riotId: event.target.value })}
                placeholder="GameName#TAG"
                disabled={Boolean(uploadedJourney)}
                required
                className="w-full rounded-lg border border-runeterra-gold/25 bg-black/35 px-4 py-3 text-runeterra-gold-light outline-none focus:border-runeterra-gold disabled:opacity-60"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {mode === 'riot' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-runeterra-gold-light">Server</label>
                  <select value={form.platform} onChange={event => setForm({ ...form, platform: event.target.value })} className="w-full rounded-lg border border-runeterra-gold/25 bg-zinc-900 px-4 py-3 text-runeterra-gold-light">
                    <option value="euw1">EU West</option><option value="eun1">EU Nordic & East</option><option value="na1">North America</option>
                    <option value="kr">Korea</option><option value="br1">Brazil</option><option value="jp1">Japan</option>
                    <option value="la1">LAN</option><option value="la2">LAS</option><option value="oc1">Oceania</option>
                  </select>
                </div>
              )}
              <div>
                <label className="mb-2 block text-sm font-medium text-runeterra-gold-light">Season year</label>
                <input type="number" min="2018" max="2100" value={form.year} onChange={event => setForm({ ...form, year: Number(event.target.value) })} className="w-full rounded-lg border border-runeterra-gold/25 bg-zinc-900 px-4 py-3 text-runeterra-gold-light" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-runeterra-gold-light">Journey archetype</label>
                <select value={form.archetype} onChange={event => setForm({ ...form, archetype: event.target.value })} disabled={Boolean(uploadedJourney)} className="w-full rounded-lg border border-runeterra-gold/25 bg-zinc-900 px-4 py-3 text-runeterra-gold-light disabled:opacity-60">
                  <option value="explorer">Explorer</option><option value="warrior">Warrior</option><option value="sage">Sage</option><option value="guardian">Guardian</option>
                </select>
              </div>
              {mode === 'riot' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-runeterra-gold-light">Ranked queue</label>
                  <select value={form.queue} onChange={event => setForm({ ...form, queue: Number(event.target.value) as 420 | 440 })} className="w-full rounded-lg border border-runeterra-gold/25 bg-zinc-900 px-4 py-3 text-runeterra-gold-light">
                    <option value={420}>Solo / Duo</option><option value={440}>Flex</option>
                  </select>
                </div>
              )}
            </div>

            {!uploadedJourney && (
              <label className="flex items-start gap-3 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-4">
                <input type="checkbox" checked={form.useLocalLlm} onChange={event => setForm({ ...form, useLocalLlm: event.target.checked })} className="mt-1 h-4 w-4" />
                <span>
                  <span className="block font-medium text-cyan-200">Narrate with the configured local LLM</span>
                  <span className="mt-1 block text-xs text-gray-400">If Ollama is unavailable, the app still produces a deterministic evidence-based journey.</span>
                </span>
              </label>
            )}

            {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

            <button disabled={isLoading || (mode === 'upload' && !uploadPayload && !uploadedJourney)} className="w-full rounded-xl bg-gradient-to-r from-runeterra-gold to-amber-200 px-6 py-4 font-bold text-runeterra-darker transition hover:shadow-lg hover:shadow-runeterra-gold/20 disabled:cursor-not-allowed disabled:opacity-50">
              {isLoading ? 'Charting the route…' : uploadedJourney ? 'Open this journey' : 'Create the Runeterra journey'}
            </button>
          </form>
        </motion.section>
      </div>
    </main>
  );
}

export default App;
