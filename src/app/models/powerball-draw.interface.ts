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
