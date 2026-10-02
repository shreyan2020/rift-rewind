import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface JourneyRequest {
  platform: string;
  riotId: string;
  archetype: string;
  year: number;
  queue: 420 | 440;
  maxMatches: number;
  useLocalLlm: boolean;
}

export interface JobStatus {
  jobId: string;
  playerName: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  progress: number;
  stage: string;
  resultReady: boolean;
  error?: string | null;
}

export interface JourneyWaypoint {
  quarter: string;
  act: string;
  region: string;
  theme: string;
  coordinates: { x: number; y: number };
  trigger: string;
  dominant_value: { name: string; score: number };
  evidence: string[];
}

export interface QuarterStats {
  games: number;
  wins?: number;
  win_rate?: number;
  kda_proxy: number;
  kills_per_game?: number;
  deaths_per_game?: number;
  assists_per_game?: number;
  cs_per_min: number;
  gold_per_min: number;
  vision_score_per_min: number;
  damage_per_min?: number;
  objective_damage_per_min?: number;
  kill_participation?: number;
  control_wards_per_game?: number;
  primary_role?: string;
  primary_role_share?: number;
  unique_champions?: number;
  solo_kills?: number;
}

export interface Quarter {
  quarter: string;
  act?: string;
  date_range?: string;
  values: Record<string, number>;
  top_values: [string, number][];
  evidence?: string[];
  stats: QuarterStats;
  top_champions?: Array<{ name: string; games: number; win_rate?: number; avg_kda?: number }>;
  lore: string;
  story_beat?: string;
  reflection: string;
  region_arc?: string;
  journey_trigger?: string;
}

export interface Insight {
  category: string;
  priority: string;
  insight: string;
  action?: string;
  evidence?: string;
}

export interface ChampionSummary {
  name: string;
  games: number;
  win_rate: number;
  avg_kda: number;
  avg_damage?: number;
  avg_cs_per_min?: number;
}

export interface ChampionAnalysis {
  available?: boolean;
  total_unique_champions?: number;
  top_champions?: ChampionSummary[];
  most_played?: ChampionSummary[];
  one_tricks?: Array<ChampionSummary | string>;
  versatility_score?: number;
}

export interface MetricTrend {
  values: number[];
  direction: 'improving' | 'declining' | 'stable' | string;
  change_pct: number;
  best_quarter: string;
}

export interface JourneyTrends {
  available?: boolean;
  kda?: MetricTrend;
  cs_per_min?: MetricTrend;
  gold_per_min?: MetricTrend;
  vision_score?: MetricTrend;
  kill_participation?: MetricTrend;
  win_rate?: MetricTrend;
  overall?: { improving_metrics: number; declining_metrics: number; summary: string };
  [key: string]: unknown;
}

export interface JourneyHighlights {
  best_kda_game?: { champion: string; value: number; won?: boolean };
  most_damage_game?: { champion: string; damage: number };
  most_kills_game?: { champion: string; kills: number };
  first_bloods?: number;
  objective_steals?: number;
  perfect_games?: number;
}

export interface YearSummary {
  total_games: number;
  wins?: number;
  win_rate?: number;
  year_avg_kda: number;
  year_avg_cs_per_min?: number;
  year_avg_vision_score?: number;
  total_unique_champions: number;
  most_played_champion?: string;
  achievements?: string[];
  strengths?: string[];
  growth_areas?: string[];
  overall_trend?: string;
  best_quarter?: string;
}

export interface Finale {
  lore: string;
  season_title?: string;
  final_reflection: string[];
  total_games: number;
  journey_map?: JourneyWaypoint[];
  trends?: JourneyTrends;
  highlights?: JourneyHighlights;
  champion_analysis?: ChampionAnalysis;
  insights?: Insight[];
  year_summary?: YearSummary;
}

export interface CompleteJourney {
  type: 'complete-journey';
  version: string;
  metadata: {
    playerName: string;
    archetype: string;
    year: number;
    totalGames: number;
    generatedAt?: string;
    source?: string;
  };
  quarters: Record<string, Quarter>;
  finale: Finale;
  narrative?: { provider: string; model?: string | null; generated_sections?: number };
}

export interface DuoValue {
  name: string;
  score: number;
}

export interface PlayerAgent {
  id: 'agent-a' | 'agent-b';
  name: string;
  skill_name: string;
  skill_markdown: string;
  style: string;
  role: string;
  home_region: string;
  top_values: DuoValue[];
  value_scores: Record<string, number>;
  champions: string[];
  strengths: string[];
  growth_areas: string[];
  decision_policy: string;
  negotiation_policy: string;
  non_negotiable: string;
  concession_rule: string;
  evidence: string[];
  total_games: number;
}

export interface DuoValuePair {
  name: string;
  agent_a: number;
  agent_b: number;
  gap: number;
  combined: number;
}

export interface NegotiationTurn {
  turn: number;
  speaker_id: 'agent-a' | 'agent-b';
  speaker_name: string;
  intent: 'proposal' | 'challenge' | 'concession' | 'counteroffer' | 'agreement';
  message: string;
  cited_evidence: string;
  llm_generated: boolean;
}

export interface DuoWaypoint {
  index: number;
  act: string;
  region: string;
  theme: string;
  coordinates: { x: number; y: number };
  why: string;
  agent_a_contribution: string;
  agent_b_contribution: string;
  negotiated_rule: string;
}

export interface DuoJourney {
  type: 'duo-journey';
  version: string;
  metadata: { generatedAt: string; source: string; playerNames: string[] };
  agents: [PlayerAgent, PlayerAgent];
  compatibility: {
    score: number;
    relationship: string;
    shared_values: DuoValuePair[];
    tensions: DuoValuePair[];
    complements: string[];
  };
  negotiation: {
    agenda: string[];
    turns: NegotiationTurn[];
    pact: {
      title: string;
      shared_mission: string;
      rules: string[];
      concessions: Array<{ agent: string; offers: string; protects: string }>;
      success_signal: string;
    };
  };
  origins: Array<{ agent_id: 'agent-a' | 'agent-b'; region: string; coordinates: { x: number; y: number } }>;
  journey_map: DuoWaypoint[];
  story: string;
  narrative: { provider: string; model?: string | null; generated_sections: number };
}

export interface UploadJourneyRequest {
  playerName: string;
  archetype: string;
  year: number;
  puuid?: string;
  useLocalLlm: boolean;
  payload: unknown;
}

export async function createJourney(request: JourneyRequest): Promise<JobStatus> {
  return (await axios.post(`${API_BASE_URL}/journeys`, request)).data;
}

export async function createJourneyFromUpload(request: UploadJourneyRequest): Promise<JobStatus> {
  return (await axios.post(`${API_BASE_URL}/journeys/upload`, request)).data;
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  return (await axios.get(`${API_BASE_URL}/jobs/${jobId}`)).data;
}

export async function getJourney(jobId: string): Promise<CompleteJourney> {
  return (await axios.get(`${API_BASE_URL}/journeys/${jobId}`)).data;
}

export async function createDuoJourney(player1: CompleteJourney, player2: CompleteJourney, useLocalLlm: boolean): Promise<JobStatus> {
  return (await axios.post(`${API_BASE_URL}/duo-journeys`, { player1, player2, useLocalLlm })).data;
}

export async function getDuoJourney(jobId: string): Promise<DuoJourney> {
  return (await axios.get(`${API_BASE_URL}/duo-journeys/${jobId}`)).data;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { detail?: string; error?: string } | undefined;
    return data?.detail || data?.error || error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
