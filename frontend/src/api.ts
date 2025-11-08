import axios from 'axios';

// Use proxy in development, direct API in production
const API_BASE_URL = import.meta.env.DEV 
  ? '/api' 
  : 'https://vassfd5se4.execute-api.eu-west-1.amazonaws.com';

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

export const getQuarterStory = async (bucketUrl: string, quarter: string): Promise<Quarter> => {
  // S3 bucket URL format: s3://bucket/jobId/Q1/story.json
  // We'll need to construct the proper URL
  const s3BucketName = 'rift-rewind-data-567020425899-eu-west-1';
  const storyUrl = `https://${s3BucketName}.s3.eu-west-1.amazonaws.com/${bucketUrl}${quarter}/story.json`;
  const response = await axios.get(storyUrl);
  return response.data;
};
