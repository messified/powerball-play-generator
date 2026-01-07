/**
 * Interface for Powerball number generation strategies.
 * Each strategy implements a different algorithm for generating lottery numbers.
 */
export interface GenerationStrategy {
  /**
   * Generates a Powerball play (6 numbers: 5 white balls + 1 powerball).
   * 
   * @param context - Context data needed for generation (historical data, synergy maps, etc.)
   * @returns Promise resolving to an array of 6 strings representing the play
   */
  generate(context: GenerationContext): Promise<string[]>;

  /**
   * Returns a human-readable name for this strategy.
   */
  getName(): string;
}

/**
 * Context data passed to generation strategies.
 * Contains all necessary data and helper methods for number generation.
 */
export interface GenerationContext {
  // Historical data
  historicalData: string[][];
  filteredParsedSets: Array<{ key: string; numbers: number[] }>;
  
  // Synergy maps
  synergyMap: {
    [positionIndex: number]: {
      [currentNum: string]: { [nextNum: string]: number };
    };
  };
  
  // Helper methods (delegated from service)
  pickAdvancedProbabilityNumber: (bestGuessSet: string[]) => string;
  pickAdvancedProbabilityNumberWithRecency: (bestGuessSet: string[], recencyThreshold: number) => string;
  pickMostFrequentFirstNumber: (powerball?: boolean) => string;
  pickWeightedRandomFirstNumber: (powerball?: boolean) => string;
  generateNextNumberArray: (selectedNumber: string, customIndex?: number) => string[];
  randomNumberInRange: (min: number, max: number) => string;
  buildWithTheFirst: (firstPredictedNumber: string, initialPlay: any) => string[];
  pickPowerballAi: () => string;
  generateFallbackSet: () => string[];
  sortGeneratedSet: (generated: any) => any;
}
