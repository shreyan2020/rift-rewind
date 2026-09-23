import axios from 'axios';

// Deployment URLs are public configuration; credentials belong in the backend.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const STORY_BASE_URL = (import.meta.env.VITE_STORY_BASE_URL || '').replace(/\/$/, '');

function resolveStoryUrl(path: string): string {
  if (!STORY_BASE_URL) throw new Error('Set VITE_STORY_BASE_URL to your story bucket HTTPS URL.');
  return `${STORY_BASE_URL}/${path.replace(/^\//, '')}`;
}

export interface JourneyRequest {
  platform: string;
  riotId: string;
  archetype: string;
  bypassCache?: boolean;
}

export interface Quarter {
  quarter: string;
  values: Record<string, number>;
  top_values: [string, number][];
  stats: {
    games: number;
    kda_proxy: number;
    cs_per_min: number;
    gold_per_min: number;
    vision_score_per_min: number;
    ping_rate_per_min: number;
  };
  lore: string;
  reflection: string;
  region_arc?: string;
}

export interface JobStatus {
  jobId: string;
  riotId: string;
  platform: string;
  archetype: string;
  status: string;
  quarters: {
    Q1: 'pending' | 'fetching' | 'fetched' | 'ready' | 'error';
    Q2: 'pending' | 'fetching' | 'fetched' | 'ready' | 'error';
    Q3: 'pending' | 'fetching' | 'fetched' | 'ready' | 'error';
    Q4: 'pending' | 'fetching' | 'fetched' | 'ready' | 'error';
  };
  s3Base: string;
}

export const createJourney = async (request: JourneyRequest): Promise<{ jobId: string; queued: boolean }> => {
  const response = await axios.post(`${API_BASE_URL}/journey`, request);
  return response.data;
};

export interface UploadJourneyRequest {
  platform: string;
  riotId: string;
  archetype: string;
  uploadedMatches: {
    Q1: any[];
    Q2: any[];
    Q3: any[];
    Q4: any[];
  };
}

export const createJourneyFromUpload = async (request: UploadJourneyRequest): Promise<{ jobId: string; queued: boolean }> => {
  const response = await axios.post(`${API_BASE_URL}/journey/upload`, request);
  return response.data;
};

export const getJobStatus = async (jobId: string): Promise<JobStatus> => {
  const response = await axios.get(`${API_BASE_URL}/status/${jobId}`);
  return response.data;
};

export interface Finale {
  lore: string;
  final_reflection: string[];
  total_games: number;
  quarters: Quarter[];
  trends?: {
    kda_trend: { direction: string; change_percentage: number; best_quarter: string };
    cs_trend: { direction: string; change_percentage: number; best_quarter: string };
    gold_trend: { direction: string; change_percentage: number; best_quarter: string };
    vision_trend: { direction: string; change_percentage: number; best_quarter: string };
  };
  highlights?: {
    best_kda_game: any;
    most_kills_game: any;
    most_damage_game: any;
    perfect_games: number;
    first_bloods: number;
    pentakills: number;
  };
  champion_analysis?: {
    top_champions: Array<{ name: string; games: number; avg_kda: number; win_rate: number }>;
    one_tricks: string[];
    versatility_score: number;
  };
  comebacks?: {
    comeback_games: any[];
    total_comebacks: number;
    resilience_score: number;
  };
  insights?: Array<{ insight: string; priority: string }>;
  year_summary?: {
    total_games: number;
    year_avg_kda: number;
    year_avg_cs_per_min: number;
    year_avg_vision_score: number;
    total_unique_champions: number;
    most_played_champion: string;
    comeback_victories: number;
    resilience_score: number;
    achievements: string[];
    strengths: string[];
    growth_areas: string[];
    overall_trend: string;
    best_quarter: string;
  };
}

export const getQuarterStory = async (bucketUrl: string, quarter: string): Promise<Quarter> => {
  // S3 bucket URL format: s3://bucket/jobId/Q1/story.json
  // We'll need to construct the proper URL
  const storyUrl = resolveStoryUrl(`${bucketUrl}${quarter}/story.json`);
  const response = await axios.get(storyUrl);
  return response.data;
};

export const getFinale = async (bucketUrl: string): Promise<Finale> => {
  const finaleUrl = resolveStoryUrl(`${bucketUrl}finale.json`);
  const response = await axios.get(finaleUrl);
  return response.data;
};
