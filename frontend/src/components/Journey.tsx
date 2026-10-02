import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { apiErrorMessage, getJobStatus, getJourney, type CompleteJourney } from '../api';
import ChapterView from './ChapterView';
import FinalDashboard from './FinalDashboard';
import InsightsView from './InsightsView';
import JourneyMap from './JourneyMap';

interface JourneyProps {
  jobId: string;
  riotId: string;
  onReset?: () => void;
  uploadedJourneyData?: CompleteJourney;
}

type View = 'MAP' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FINAL' | 'INSIGHTS';

export default function Journey({ jobId, riotId, onReset, uploadedJourneyData }: JourneyProps) {
  const [journey, setJourney] = useState<CompleteJourney | null>(uploadedJourneyData || null);
  const [view, setView] = useState<View>('MAP');
  const [progress, setProgress] = useState(uploadedJourneyData ? 100 : 0);
  const [stage, setStage] = useState(uploadedJourneyData ? 'Journey ready' : 'Starting the local pipeline');
  const [error, setError] = useState('');

  useEffect(() => {
    if (uploadedJourneyData) return;
    let active = true;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const job = await getJobStatus(jobId);
        if (!active) return;
        setProgress(job.progress);
        setStage(job.stage);
        if (job.status === 'error') {
          setError(job.error || 'Journey generation failed.');
          return;
        }
        if (job.resultReady) {
          setJourney(await getJourney(jobId));
          return;
        }
        timer = window.setTimeout(poll, 1200);
      } catch (reason: unknown) {
        if (active) setError(apiErrorMessage(reason, 'The local API stopped responding.'));
      }
    };
    void poll();
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [jobId, uploadedJourneyData]);

  const route = useMemo(() => journey?.finale.journey_map || Object.keys(journey?.quarters || {}).map((quarter, index) => ({
    quarter,
    act: ['The Calling', 'The Ascent', 'The Trial', 'The Reckoning'][index],
    region: journey?.quarters[quarter]?.region_arc || 'Runeterra',
    theme: '', trigger: journey?.quarters[quarter]?.journey_trigger || '',
    coordinates: [{ x: 18, y: 68 }, { x: 42, y: 30 }, { x: 70, y: 64 }, { x: 86, y: 28 }][index],
    dominant_value: { name: journey?.quarters[quarter]?.top_values?.[0]?.[0] || 'Unknown', score: journey?.quarters[quarter]?.top_values?.[0]?.[1] || 0 },
    evidence: journey?.quarters[quarter]?.evidence || [],
  })), [journey]);

  if (!journey) {
    return (
      <main className="flex min-h-screen items-center justify-center map-grid px-4">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl rounded-2xl border border-runeterra-gold/25 bg-runeterra-darker/90 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-6 h-16 w-16 rounded-full border-2 border-runeterra-gold/30 border-t-runeterra-gold animate-spin" />
          <h1 className="text-2xl font-bold text-runeterra-gold">Charting your route</h1>
          <p className="mt-2 min-h-6 text-sm text-gray-400">{stage}</p>
          <div className="mt-7 h-2 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full bg-gradient-to-r from-cyan-400 to-runeterra-gold" animate={{ width: `${progress}%` }} /></div>
          <div className="mt-2 text-right text-xs text-runeterra-gold/70">{progress}%</div>
          {error && (
            <div className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-left text-sm text-red-200">
              {error}
              {onReset && <button onClick={onReset} className="mt-4 block text-runeterra-gold underline">Return to the start</button>}
            </div>
          )}
        </motion.section>
      </main>
    );
  }

  const playerName = journey.metadata?.playerName || riotId;
  if (view === 'MAP') {
    return <JourneyMap route={route} quarters={journey.quarters} playerName={playerName} seasonTitle={journey.finale.season_title} onSelect={quarter => setView(quarter as View)} onFinale={() => setView('FINAL')} />;
  }
  if (view === 'FINAL') {
    return <FinalDashboard quarters={journey.quarters} riotId={playerName} finaleData={journey.finale} onNewJourney={onReset} onViewAnalytics={() => setView('INSIGHTS')} onViewMap={() => setView('MAP')} />;
  }
  if (view === 'INSIGHTS') {
    return <InsightsView insights={journey.finale.insights || []} trends={journey.finale.trends} highlights={journey.finale.highlights} championAnalysis={journey.finale.champion_analysis} yearSummary={journey.finale.year_summary} quarters={journey.quarters} onBack={() => setView('FINAL')} />;
  }

  const quarterOrder: View[] = ['Q1', 'Q2', 'Q3', 'Q4'];
  const index = quarterOrder.indexOf(view);
  const next = quarterOrder[index + 1];
  return (
    <ChapterView
      quarter={view}
      data={journey.quarters[view]}
      riotId={playerName}
      onMap={() => setView('MAP')}
      onNext={() => setView(next || 'FINAL')}
      nextChapterReady
      nextChapterStatus={next ? `Continue to ${next}` : 'View the conclusion'}
    />
  );
}
