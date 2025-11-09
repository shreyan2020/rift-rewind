import axios from 'axios';

// Directly use AWS API endpoint (proxy not working in dev)
const API_BASE_URL = 'https://vassfd5se4.execute-api.eu-west-1.amazonaws.com';

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
  const s3BucketName = 'rift-rewind-data-567020425899-eu-west-1';
  const storyUrl = `https://${s3BucketName}.s3.eu-west-1.amazonaws.com/${bucketUrl}${quarter}/story.json`;
  console.log('Fetching story from:', storyUrl);
  const response = await axios.get(storyUrl);
  return response.data;
};

export const getFinale = async (bucketUrl: string): Promise<Finale> => {
  const s3BucketName = 'rift-rewind-data-567020425899-eu-west-1';
  const finaleUrl = `https://${s3BucketName}.s3.eu-west-1.amazonaws.com/${bucketUrl}finale.json`;
  console.log('Fetching finale from:', finaleUrl);
  const response = await axios.get(finaleUrl);
  return response.data;
};
