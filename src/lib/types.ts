export interface CampaignInput {
  handle: string;
  campaignStartDate: string; // ISO date string
  campaignEndDate: string;
  keywords: string[];
  totalBudget: number; // Total ad spend in USD
  useExactKeywords: boolean; // If true, use keywords as-is; if false, let Grok optimize
}

export interface KeywordAnalysisResult {
  isValid: boolean;
  suggestedQuery: string;
  reasoning: string;
  seasonality: 'seasonal' | 'non-seasonal' | 'event-driven';
  seasonalityExplanation: string;
  lookbackStartDate: string; // ISO date — Grok-recommended historical period start
  lookbackEndDate: string;   // ISO date — Grok-recommended historical period end
  lookbackReasoning: string; // Why Grok chose this period
  lookbackQuery?: string;     // Only present when historical data needs different terms than campaign query
  lookbackQueryReasoning?: string; // Why the lookback query differs from the campaign query
  suggestedKeywords?: string[];
}

export interface HourlyDataPoint {
  timestamp: string; // ISO string
  count: number;
}

export interface CountsResponse {
  data: HourlyDataPoint[];
  totalTweets: number;
  startTime: string;
  endTime: string;
}

export interface ThresholdRecommendation {
  onThreshold: number;
  offThreshold: number;
  consecutiveHours: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  peakHours: string[];
  avgHourlyVolume: number;
  medianHourlyVolume: number;
  stdDeviation: number;
  p75: number;
  p90: number;
  p95: number;
  estimatedTrendDays: number;     // How many days the threshold is expected to trigger
  recommendedMaxDailySpend: number; // Budget / estimated trend days
  budgetReasoning: string;        // Explanation of spend allocation
}

export interface WizardState {
  currentStep: number;
  campaignInput: CampaignInput;
  keywordAnalysis: KeywordAnalysisResult | null;
  approvedQuery: string;
  countsData: CountsResponse | null;
  thresholdRecommendation: ThresholdRecommendation | null;
  originalThresholdRecommendation: ThresholdRecommendation | null;
  isLoading: boolean;
  error: string | null;
}

export interface StatsResult {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  totalDataPoints: number;
  // Enhanced temporal stats
  dayOfWeekAvg: Record<string, number>;    // e.g. { "Sun": 12400, "Mon": 3100, ... }
  hourOfDayAvg: Record<string, number>;    // e.g. { "00": 800, "13": 5200, ... } (UTC)
  spikeCount: number;                      // Distinct spike events above P90
  avgSpikeDurationHours: number;           // Average hours per spike event
  spikeDays: number;                       // Unique calendar days that had spike activity
  quietHourPct: number;                    // % of hours below 25% of the mean
  totalDaysInData: number;                 // Total calendar days in the lookback
}
