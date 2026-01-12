/**
 * Core data model interfaces for Powerball draws
 */

export interface PowerballDraw {
  draw_date: string;
  winning_numbers: string;
  multiplier: string;
}

export interface ParsedPowerballDraw {
  date: string;
  numbers: string[];
  multiplier: string;
}

export interface PowerballNumberSet {
  first: string;
  second: string;
  third: string;
  fourth: string;
  fifth: string;
  powerball: string;
}

export interface FilteredNumberSet {
  key: string;
  numbers: number[];
}

export interface GeneratedPlay {
  initialPlay: string[];
  predictiveFreqPredictedPlay: string[];
  predictiveWeightedRandomPlay: string[];
  highestProbabilityPlay: string[];
  aiPredictiveSet: string[];
}

/**
 * Historical drawing structure used in pick checking
 */
export interface HistoricalDrawing {
  date: string;
  numbers: string[];
  multiplier: string;
}

/**
 * Drawing result from processing picks against historical draws
 */
export interface DrawingResult {
  date: string;
  historical_draw: string[];
  matching_picks_count: number;
  matching_picks: string[][];
  multiplier: string;
  month?: string;
  year?: string;
  picks?: string[][];
}

/**
 * Win structure with date and matching information
 */
export interface Win extends DrawingResult {
  month: string;
  year: string;
  picks: string[][];
}

/**
 * Result structure returned from checkPicks method
 */
export interface CheckPicksResult {
  totalWins: number;
  totalDraws: number;
  myPicks: number;
  picks: string[][];
  wins: Win[];
  organizedResults: Array<Record<string, Win[]>>;
  targetWins: {
    fourWhite: Win[];
    threeWhitePowerball: Win[];
  };
}

/**
 * Recent drawing structure
 */
export interface RecentDrawing {
  date: string;
  numbers: string[];
  multiplier: string;
}

/**
 * Future test data structure
 */
export interface FutureTestData {
  draw_date: string;
  winning_numbers: string;
  multiplier: string;
}

/**
 * Diff analysis data models for analyzing position-based differences
 * between generated picks and the latest draw
 */

/**
 * Represents the difference for a single ball at a specific position
 */
export interface BallDiff {
  position: number;
  pickValue: string;
  drawValue: string;
  diff: number;
  diffString: string;
}

/**
 * Analysis of a single pick showing all position-based differences
 */
export interface PickDiffAnalysis {
  pick: string[];
  ballDiffs: BallDiff[];
}

/**
 * Represents a recurring diff pattern at a specific position
 */
export interface DiffPattern {
  position: number;
  diffValue: number;
  frequency: number;
  percentage: number;
}

/**
 * Complete analysis of diff patterns across all picks
 */
export interface DiffPatternAnalysis {
  patterns: DiffPattern[];
  totalPicks: number;
  latestDraw: string[];
}

/**
 * Strategy name type for ensemble generation
 */
export type StrategyName = 'legacy' | 'prediction' | 'ai' | 'diffPattern' | 'ensemble';

/**
 * Strategy result (what each strategy returns for ensemble)
 */
export interface StrategyResult {
  strategy: StrategyName;
  tickets: string[][];  // Array of tickets, each is string[6]
  ticketScores?: number[];  // Optional: per-ticket scores if strategy provides them
  metadata?: {
    // Optional strategy-specific metadata
    frequencyDistributions?: {
      white: number[];  // length 69, index n-1 = frequency of number n
      powerball: number[];  // length 26, index p-1 = frequency of number p
    };
    consensusNumbers?: number[];  // Top-K numbers from this strategy
    [key: string]: any;  // Allow extensibility
  };
}

/**
 * Ensemble configuration
 */
export interface EnsembleConfig {
  // Weights (normalized, sum to 1.0)
  weights: {
    legacy: number;
    prediction: number;
    ai: number;
    diffPattern: number;
  };
  
  // Weight learning
  weightLearning: {
    enabled: boolean;
    method: 'equal' | 'windowed' | 'ema' | 'bayesian';
    windowSize?: number;  // For windowed method
    alpha?: number;  // For EMA method
    priorStrength?: number;  // For Bayesian method
  };
  
  // Ticket generation
  ticketCount: number;  // N tickets to generate
  reusePenalty: {
    white: number;  // λ for whites
    powerball: number;  // λ_pb for powerball
  };
  
  // Constraints
  constraints: {
    evenOddBalance: boolean;
    lowHighSplit: boolean;
    sumRange: boolean;
    diffPatternAlignment: boolean;
  };
  
  // Consensus
  consensus: {
    enabled: boolean;
    topK: number;  // K for top-K per strategy
    minStrategies: number;  // Minimum strategies for consensus
    injectCount: number;  // Number of consensus numbers per ticket (or range [min, max])
  };
  
  // Deterministic mode
  deterministic: {
    enabled: boolean;
    seed?: number;  // Random seed for reproducibility
  };
}

/**
 * Portfolio metrics for ensemble strategy
 */
export interface PortfolioMetrics {
  uniqueWhites: number;
  coverageRatio: number;
  maxReuse: number;
  concentrationScore: number;
  expectedHitProxy: number;
  approximateHistoricalScore?: number;  // If historical simulation was run
}

/**
 * Ensemble result
 */
export interface EnsembleResult {
  strategy: 'ensemble';
  tickets: string[][];
  ticketScores: number[];  // Per-ticket expected hit proxy
  portfolioMetrics: PortfolioMetrics;
  strategyContributions: {
    // Per-ticket breakdown of which strategies contributed numbers
    [ticketIndex: number]: {
      [strategy: string]: number;  // Count of numbers from this strategy
    };
  };
  blendedProbabilities: {
    white: number[];  // Pwhite[1..69]
    powerball: number[];  // PPB[1..26]
  };
  metadata: {
    weightsUsed: EnsembleConfig['weights'];
    consensusNumbers?: number[];
    [key: string]: any;
  };
}
