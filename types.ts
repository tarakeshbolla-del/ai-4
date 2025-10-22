export interface SimilarTicket {
  ticket_no: string;
  problem_description: string;
  solution_text: string;
  similarity_score: number;
  category?: string;
  // Fix: Add optional priority property to match data structure from CSV upload and prevent type error.
  priority?: string;
  // New fields from user data
  technician?: string;
  status?: string;
  created_time?: string;
  responded_time?: string;
  due_by_time?: string;
  request_status?: string; // Mapped from 'Request Status'
  request_type?: string;
}

export interface SlaRiskTicket {
  ticket_no: string;
  problem_snippet: string;
  technician: string;
  timeRemaining: string; // e.g. "2h 15m", "-30m" for overdue
  riskScore: number; // 0 to 1
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

export interface OutlierReport {
  rareCategories: { name: string; count: number }[];
  descriptionLength: {
    min: number;
    max: number;
    avg: number;
    shortOutlierThreshold: number;
    longOutlierThreshold: number;
    shortOutliers: number;
    longOutliers: number;
  };
}

export interface EdaReport {
  fileName: string;
  fileSize: number;
  rowCount: number;
  columns: { name: string; type: string; missing: number }[];
  categoryDistribution: { name: string; value: number }[];
  outlierReport: OutlierReport;
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
    isNew?: boolean;
}

export interface TicketVolumeForecastDataPoint {
  day: string;
  actual?: number;
  forecast?: number;
}

export type CsvHeaderMapping = Record<string, string | null>;

export interface ModelAccuracyReport {
    categoryAccuracy: number;
    priorityAccuracy: number;
    overallScore: number;
    notes: string[];
}

// New types for added charts
export interface TechnicianWorkloadData {
  name: string;
  tickets: number;
}

export interface TicketStatusData {
  name: string;
  value: number;
}

export interface AvgResolutionTimeData {
  name: string;
  'Avg Hours': number;
}

export interface DepartmentalTicketData {
  name: string;
  Total: number;
}