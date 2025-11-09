import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { getJobStatus, getQuarterStory, getFinale, type JobStatus, type Quarter, type Finale } from '../api';
import ChapterView from './ChapterView';
import FinalDashboard from './FinalDashboard';
import InsightsView from './InsightsView';

interface JourneyProps {
  jobId: string;
  riotId: string;
  onReset?: () => void;
}

const Journey: React.FC<JourneyProps> = ({ jobId, riotId, onReset }) => {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [currentChapter, setCurrentChapter] = useState<string | null>(null);
  const [chapterData, setChapterData] = useState<Record<string, Quarter>>({});
  const [finaleData, setFinaleData] = useState<Finale | null>(null);

  const loadChapter = useCallback(async (quarter: string, s3Base: string) => {
    if (chapterData[quarter]) return; // Already loaded
    
    try {
      const story = await getQuarterStory(s3Base, quarter);
      setChapterData(prev => ({ ...prev, [quarter]: story }));
    } catch (error) {
      console.error(`Failed to load ${quarter} story:`, error);
    }
  }, [chapterData]);

  useEffect(() => {
    const pollStatus = async () => {
      try {
        const status = await getJobStatus(jobId);
        setJobStatus(status);
        
        // Auto-show Q1 when ready
        if (status.quarters.Q1 === 'ready' && !currentChapter) {
          setCurrentChapter('Q1');
          loadChapter('Q1', status.s3Base);
        }
      } catch (error) {
        console.error('Failed to fetch job status:', error);
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [jobId, currentChapter, loadChapter]);

  const handleChapterClick = (quarter: string) => {
    if (!jobStatus || jobStatus.quarters[quarter as keyof typeof jobStatus.quarters] !== 'ready') return;
    setCurrentChapter(quarter);
    loadChapter(quarter, jobStatus.s3Base);
  };

  const getQuarterStatus = (quarter: string): string => {
    if (!jobStatus) return 'pending';
    const status = jobStatus.quarters[quarter as keyof typeof jobStatus.quarters];
    
    switch (status) {
      case 'ready':
        return 'Ready';
      case 'fetching':
      case 'fetched':
        return 'Preparing...';
      case 'error':
        return 'Error';
      default:
        return 'Pending';
    }
  };

  const isQuarterReady = (quarter: string): boolean => {
    return jobStatus?.quarters[quarter as keyof typeof jobStatus.quarters] === 'ready';
  };

  // Check if all quarters are ready and loaded
  const allQuartersReady = ['Q1', 'Q2', 'Q3', 'Q4'].every(q => isQuarterReady(q));
  const allQuartersLoaded = ['Q1', 'Q2', 'Q3', 'Q4'].every(q => chapterData[q]);
  
  // Load finale data when all quarters are ready
  useEffect(() => {
    const loadFinale = async () => {
      if (allQuartersReady && !finaleData && jobStatus) {
        try {
          const finale = await getFinale(jobStatus.s3Base);
          console.log('Loaded finale data:', finale);
          console.log('Has insights:', finale.insights);
          setFinaleData(finale);
        } catch (error) {
          console.error('Failed to load finale:', error);
        }
      }
    };
    loadFinale();
  }, [allQuartersReady, finaleData, jobStatus]);

  // Show loading until Q1 is ready
  if (!jobStatus || jobStatus.quarters.Q1 !== 'ready') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="text-6xl text-runeterra-gold mb-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            ⚔
          </motion.div>
          <p className="text-runeterra-gold-light text-xl mb-2">Preparing Your Journey...</p>
          <p className="text-gray-400">Analyzing your matches across Runeterra</p>
        </motion.div>
      </div>
    );
  }

  // Auto-load Q1 when ready
  if (jobStatus.quarters.Q1 === 'ready' && !currentChapter) {
    setCurrentChapter('Q1');
    loadChapter('Q1', jobStatus.s3Base);
  }
  
  // Show final dashboard if user is viewing Q4 and all quarters are complete
  if (currentChapter === 'Q4' && allQuartersReady && allQuartersLoaded) {
    // Load any missing quarters
    ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
      if (!chapterData[q]) {
        loadChapter(q, jobStatus.s3Base);
      }
    });
  }

  if (currentChapter && chapterData[currentChapter]) {
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const currentIndex = quarters.indexOf(currentChapter);
    const nextChapter = currentIndex < 3 ? quarters[currentIndex + 1] : null;
    
    // Only show next button if ALL previous quarters (including current) are ready
    const allPreviousReady = quarters
      .slice(0, currentIndex + 1)
      .every(q => isQuarterReady(q));
    
    const nextChapterReady = nextChapter && allPreviousReady ? isQuarterReady(nextChapter) : false;
    const nextChapterStatus = nextChapter ? getQuarterStatus(nextChapter) : '';
    
    // If on Q4 and all quarters complete, show "View Final Summary" button
    const showFinalSummary = currentChapter === 'Q4' && allQuartersReady;

    return (
      <ChapterView
        quarter={currentChapter}
        data={chapterData[currentChapter]}
        riotId={riotId}
        onNext={
          showFinalSummary && allQuartersLoaded
            ? () => setCurrentChapter('FINAL')
            : nextChapter
            ? () => handleChapterClick(nextChapter)
            : undefined
        }
        nextChapterReady={showFinalSummary ? allQuartersLoaded : nextChapterReady}
        nextChapterStatus={showFinalSummary ? 'View Final Summary' : nextChapterStatus}
      />
    );
  }
  
  // Show final dashboard
  if (currentChapter === 'FINAL' && allQuartersLoaded) {
    return (
      <FinalDashboard 
        quarters={chapterData} 
        riotId={riotId} 
        finaleData={finaleData} 
        onNewJourney={onReset}
        onViewAnalytics={() => setCurrentChapter('INSIGHTS')}
      />
    );
  }

  // Show insights/analytics view
  if (currentChapter === 'INSIGHTS' && finaleData) {
    return (
      <InsightsView
        insights={finaleData.insights || []}
        trends={finaleData.trends}
        highlights={finaleData.highlights}
        championAnalysis={finaleData.champion_analysis}
        yearSummary={finaleData.year_summary}
        onBack={() => setCurrentChapter('FINAL')}
      />
    );
  }

  return null;
};

export default Journey;
