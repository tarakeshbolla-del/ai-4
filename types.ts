export interface SimilarTicket {
  ticket_no: string;
  problem_description: string;
  solution_text: string;
  similarity_score: number;
  category?: string;
}

export interface AnalysisResultData {
  predictedModule: string;
  predictedPriority: string;
  similarIssues: SimilarTicket[];
  aiSuggestion: string;
  fromSimilarIssue?: boolean;
}

export interface Kpis {
  deflectionRate: number;
  avgTimeToResolution: number;
  firstContactResolution: number;
}

export interface RootCauseData {
  name: string;
  tickets: number;
}

export interface HeatmapDataPoint {
  category: string;
  priority: string;
  value: number;
}

export interface EdaReport {
  fileName: string;
  fileSize: number;
  rowCount: number;
  columns: { name: string; type: string; missing: number }[];
  categoryDistribution: { name: string; value: number }[];
}

export type TrainingStatus = 'idle' | 'in_progress' | 'completed' | 'failed';

export interface SunburstNode {
    name: string;
    children?: SunburstNode[];
    value?: number;
}

export interface SentimentData {
    labels: string[];
    data: (number | null)[];
}

export interface PredictiveHotspot {
  name: string;
  riskScore: number; // 0 to 1
  trending: 'up' | 'down' | 'stable';
}

export interface SlaBreachTicket {
    ticket_no: string;
    priority: 'High' | 'Critical';
    timeToBreach: string; // e.g., "35m"
}

export interface TicketVolumeForecastDataPoint {
  day: string;
  actual?: number;
  forecast?: number;
}