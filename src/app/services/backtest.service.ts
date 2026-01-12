import { Injectable } from '@angular/core';
import { PowerballService } from './powerball.service';
import { PredictionService } from './prediction.service';
import { AiPowerballService } from './ai-powerball.service';
import { PowerballConfigService } from './powerball-config.service';
import { DiffAnalysisService } from './diff-analysis.service';
import { StrategyFactoryService } from './strategies/strategy-factory.service';
import { EnsembleStrategy } from './strategies/ensemble-strategy';
import { PowerballDataMinusLatest } from '../data/historical-data';
import { PowerballDraw, DiffPatternAnalysis, StrategyResult, EnsembleConfig } from '../models/powerball-draw.interface';
import { PowerballData } from '../data/powerball-data';
import { GenerationContext } from './strategies/generation-strategy.interface';

export interface BacktestStrategy {
  name: string;
  generate: (trainingData: PowerballDraw[]) => Promise<string[][]>;
}

export interface BacktestStepResult {
  step: number;
  trainingSize: number;
  testDraw: PowerballDraw;
  predictions: {
    strategy: string;
    tickets: string[][];
    bestMatch: {
      whiteHits: number;
      powerballHit: boolean;
      matchedTicket: string[];
    };
  }[];
  timestamp: Date;
}

export interface BacktestSummary {
  totalSteps: number;
  strategies: {
    [strategyName: string]: {
      totalWhiteHits: number;
      totalPowerballHits: number;
      averageWhiteHits: number;
      averagePowerballHits: number;
      bestWhiteHits: number;
      worstWhiteHits: number;
      perfectMatches: number; // 5 white + powerball
      nearMisses: number; // 4 white + powerball or 5 white
      fourWhiteMatches: number; // Exactly 4 white matches (regardless of powerball)
      threeWhitePowerballMatches: number; // Exactly 3 white matches + powerball match
    };
  };
  overallMetrics: {
    totalPredictions: number;
    averageTicketsPerStep: number;
    totalTestDraws: number;
  };
}

export interface BacktestResult {
  summary: BacktestSummary;
  stepResults: BacktestStepResult[];
  config: BacktestConfig;
}

export interface BacktestConfig {
  initialTrainingSize: number;
  stepSize: number; // How many draws to add per step (1 = walk-forward, >1 = expanding window)
  holdoutSize: number; // How many future draws to test against (usually 1)
  minTrainingSize: number; // Minimum draws needed before testing
  strategies: string[]; // Which strategies to test: 'legacy', 'prediction', 'ai', 'all'
  ticketsPerStrategy: number; // How many tickets to generate per strategy per step
  maxSteps?: number; // Optional limit on number of steps
}

/**
 * Walk-forward backtesting service for validating Powerball prediction strategies.
 * 
 * This service implements a leakage-safe walk-forward validation approach:
 * 1. Starts with an initial training window
 * 2. Generates predictions using only data up to that point
 * 3. Compares predictions against future draws (holdout set)
 * 4. Expands the training window and repeats
 * 
 * This ensures no data leakage - predictions are made using only historical
 * data that would have been available at that point in time.
 */
@Injectable({
  providedIn: 'root',
})
export class BacktestService {
  constructor(
    private powerballService: PowerballService,
    private predictionService: PredictionService,
    private aiService: AiPowerballService,
    private configService: PowerballConfigService,
    private diffAnalysisService: DiffAnalysisService,
    private strategyFactory: StrategyFactoryService,
    private ensembleStrategy: EnsembleStrategy
  ) {}

  /**
   * Main entry point for walk-forward backtesting.
   * 
   * @param config Backtesting configuration
   * @param historicalData Optional historical data (defaults to PowerballDataMinusLatest)
   * @returns Complete backtest results with summary and step-by-step details
   */
  async runBacktest(
    config: Partial<BacktestConfig> = {},
    historicalData: PowerballDraw[] = PowerballData
  ): Promise<BacktestResult> {
    const fullConfig: BacktestConfig = {
      initialTrainingSize: 100,
      stepSize: 1,
      holdoutSize: 1,
      minTrainingSize: 50,
      strategies: ['all'],
      ticketsPerStrategy: 40,
      ...config,
    };

    // Sort data by date (oldest first) to ensure proper chronological order
    const sortedData = [...historicalData].sort((a, b) => {
      return new Date(a.draw_date).getTime() - new Date(b.draw_date).getTime();
    });

    // Filter by fromDate if configured
    const fromDate = this.configService.get('fromDate');
    const filteredData = sortedData.filter((draw) => {
      const drawDate = new Date(draw.draw_date);
      return drawDate >= fromDate;
    });

    if (filteredData.length < fullConfig.minTrainingSize + fullConfig.holdoutSize) {
      throw new Error(
        `Insufficient data: need at least ${fullConfig.minTrainingSize + fullConfig.holdoutSize} draws, got ${filteredData.length}`
      );
    }

    const stepResults: BacktestStepResult[] = [];
    let currentTrainingSize = fullConfig.initialTrainingSize;
    let step = 0;

    // Walk-forward loop
    while (
      currentTrainingSize + fullConfig.holdoutSize <= filteredData.length &&
      (!fullConfig.maxSteps || step < fullConfig.maxSteps)
    ) {
      const trainingData = filteredData.slice(0, currentTrainingSize);
      const testDraw = filteredData[currentTrainingSize]; // Single holdout draw

      if (!testDraw) {
        break; // No more test data
      }

      // Generate predictions for all strategies (pass previous steps for weight learning)
      const predictions = await this.generatePredictionsForStrategies(
        trainingData,
        fullConfig,
        stepResults // Pass accumulated step results for ensemble weight learning
      );

      // Evaluate predictions against test draw
      const evaluatedPredictions = predictions.map((pred) => ({
        strategy: pred.strategy,
        tickets: pred.tickets,
        bestMatch: this.evaluateMatch(pred.tickets, testDraw),
      }));

      stepResults.push({
        step,
        trainingSize: currentTrainingSize,
        testDraw,
        predictions: evaluatedPredictions,
        timestamp: new Date(),
      });

      // Expand training window
      currentTrainingSize += fullConfig.stepSize;
      step++;
    }

    // Generate summary statistics
    const summary = this.generateSummary(stepResults, fullConfig);

    return {
      summary,
      stepResults,
      config: fullConfig,
    };
  }

  /**
   * Generates predictions for all configured strategies using only training data.
   */
  private async generatePredictionsForStrategies(
    trainingData: PowerballDraw[],
    config: BacktestConfig,
    previousStepResults?: BacktestStepResult[]
  ): Promise<{ strategy: string; tickets: string[][] }[]> {
    const strategies: { strategy: string; tickets: string[][] }[] = [];
    const strategyList = this.resolveStrategies(config.strategies);

    for (const strategyName of strategyList) {
      try {
        const tickets = await this.generateStrategyPredictions(
          strategyName,
          trainingData,
          config.ticketsPerStrategy,
          previousStepResults
        );
        strategies.push({ strategy: strategyName, tickets });
      } catch (error) {
        console.error(`Error generating predictions for ${strategyName}:`, error);
        strategies.push({ strategy: strategyName, tickets: [] });
      }
    }

    return strategies;
  }

  /**
   * Resolves strategy names to actual strategy list.
   */
  private resolveStrategies(strategyConfig: string[]): string[] {
    if (strategyConfig.includes('all')) {
      return ['legacy', 'prediction', 'ai', 'diffPattern'];
    }
    return strategyConfig;
  }

  /**
   * Gets default ensemble configuration.
   */
  private getDefaultEnsembleConfig(numTickets: number): EnsembleConfig {
    return {
      weights: {
        legacy: 0.25,
        prediction: 0.25,
        ai: 0.25,
        diffPattern: 0.25,
      },
      weightLearning: {
        enabled: false,
        method: 'equal',
      },
      ticketCount: numTickets,
      reusePenalty: {
        white: 0.1,
        powerball: 0.15,
      },
      constraints: {
        evenOddBalance: true,
        lowHighSplit: true,
        sumRange: true,
        diffPatternAlignment: false,
      },
      consensus: {
        enabled: true,
        topK: 10,
        minStrategies: 2,
        injectCount: 1,
      },
      deterministic: {
        enabled: false,
      },
    };
  }

  /**
   * Generates predictions for a specific strategy using only training data.
   */
  private async generateStrategyPredictions(
    strategyName: string,
    trainingData: PowerballDraw[],
    numTickets: number,
    previousStepResults?: BacktestStepResult[]
  ): Promise<string[][]> {
    switch (strategyName) {
      case 'legacy':
        return this.generateLegacyPredictions(trainingData, numTickets);
      case 'prediction':
        return this.generatePredictionServicePredictions(trainingData, numTickets);
      case 'ai':
        return this.generateAiPredictions(trainingData, numTickets);
      case 'diffPattern':
        return this.generateDiffPatternPredictions(trainingData, numTickets);
      case 'ensemble':
        return this.generateEnsemblePredictions(trainingData, numTickets, previousStepResults);
      default:
        throw new Error(`Unknown strategy: ${strategyName}`);
    }
  }

  /**
   * Generates predictions using the ensemble strategy.
   * This combines all base strategies (legacy, prediction, ai, diffPattern) into a single ensemble.
   */
  private async generateEnsemblePredictions(
    trainingData: PowerballDraw[],
    numTickets: number,
    previousStepResults?: BacktestStepResult[]
  ): Promise<string[][]> {
    // Generate predictions from all base strategies
    const baseStrategyNames = ['legacy', 'prediction', 'ai', 'diffPattern'];
    const strategyResults: StrategyResult[] = [];

    for (const strategyName of baseStrategyNames) {
      try {
        const tickets = await this.generateStrategyPredictions(
          strategyName,
          trainingData,
          numTickets // Generate same number of tickets per strategy
        );
        
        strategyResults.push({
          strategy: strategyName as StrategyResult['strategy'],
          tickets,
        });
      } catch (error) {
        console.warn(`Error generating ${strategyName} predictions for ensemble:`, error);
        // Continue with other strategies
      }
    }

    // If no strategies succeeded, fallback to legacy
    if (strategyResults.length === 0) {
      return this.generateLegacyPredictions(trainingData, numTickets);
    }

    // Get ensemble configuration (default for now, can be made configurable later)
    const ensembleConfig = this.getDefaultEnsembleConfig(numTickets);

    // Apply weight learning if enabled and we have previous step results
    if (ensembleConfig.weightLearning.enabled && previousStepResults && previousStepResults.length > 0) {
      const learnedWeights = this.ensembleStrategy.calculateLearnedWeights(
        previousStepResults,
        ensembleConfig
      );
      ensembleConfig.weights = learnedWeights;
    }

    // Generate ensemble tickets
    try {
      const ensembleResult = await this.ensembleStrategy.generateEnsembleTickets(
        strategyResults,
        ensembleConfig
      );
      return ensembleResult.tickets;
    } catch (error) {
      console.error('Error generating ensemble tickets:', error);
      // Fallback to legacy if ensemble fails
      return this.generateLegacyPredictions(trainingData, numTickets);
    }
  }

  /**
   * Generates predictions using PowerballService (legacy strategies).
   */
  private async generateLegacyPredictions(
    trainingData: PowerballDraw[],
    numTickets: number
  ): Promise<string[][]> {
    // Convert PowerballDraw[] to the format expected by PowerballService
    const formattedTrainingData = trainingData.map((draw) => ({
      draw_date: draw.draw_date,
      winning_numbers: draw.winning_numbers,
      multiplier: draw.multiplier,
    }));

    const tickets: string[][] = [];

    // Generate multiple tickets using the training data
    for (let i = 0; i < numTickets; i++) {
      const result = await this.powerballService.generatePowerballPlay(formattedTrainingData);
      // Use predictiveWeightedRandomPlay as the default strategy
      const play = result?.predictiveWeightedRandomPlay || [];
      if (play.length === 6) {
        tickets.push(play.map((num: string) => num.padStart(2, '0')));
      }
    }

    return tickets;
  }

  /**
   * Generates predictions using PredictionService (higher-order Markov).
   */
  private async generatePredictionServicePredictions(
    trainingData: PowerballDraw[],
    numTickets: number
  ): Promise<string[][]> {
    // Convert PowerballDraw[] to the format expected by PredictionService
    const formattedTrainingData = trainingData.map((draw) => ({
      draw_date: draw.draw_date,
      winning_numbers: draw.winning_numbers,
      multiplier: draw.multiplier,
    }));

    const tickets: string[][] = [];

    for (let i = 0; i < numTickets; i++) {
      const play = await this.predictionService.generatePowerballPlay(formattedTrainingData);
      if (play.length === 6) {
        tickets.push(play);
      }
    }

    return tickets;
  }

  /**
   * Generates predictions using AiPowerballService (ML backend).
   */
  private async generateAiPredictions(
    trainingData: PowerballDraw[],
    numTickets: number
  ): Promise<string[][]> {
    // Convert training data to number[][] format
    const historicalDraws = trainingData.map((draw) => {
      return draw.winning_numbers
        .split(' ')
        .map((n) => parseInt(n, 10));
    });

    const mlConfig = this.configService.get('mlGeneration');
    const batch = await this.aiService.generateBatch(historicalDraws, {
      num_tickets: numTickets,
      diversity_min_hamming: mlConfig.diversityMinHamming,
      recency_decay: mlConfig.recencyDecay,
      alpha_smooth: mlConfig.alphaSmooth,
      temperature: mlConfig.temperature,
    });

    if (!batch || !batch.tickets) {
      return [];
    }

    return batch.tickets.map((ticket) => ticket.full_set);
  }

  /**
   * Generates predictions using the diff pattern strategy.
   * This method:
   * 1. Generates initial picks using a base strategy (legacy) to establish patterns
   * 2. Gets the latest draw from training data
   * 3. Analyzes initial picks against the latest draw to identify patterns
   * 4. Generates additional picks using the diff pattern strategy
   * 5. Returns the combined picks (initial + diff pattern generated)
   * 
   * @param trainingData - Historical draws to use for training
   * @param numTickets - Total number of tickets to generate
   * @returns Array of generated picks
   */
  private async generateDiffPatternPredictions(
    trainingData: PowerballDraw[],
    numTickets: number
  ): Promise<string[][]> {
    if (!trainingData || trainingData.length === 0) {
      return [];
    }

    // Step 1: Generate initial picks using legacy strategy (about 30% of total)
    const initialPicksCount = Math.max(1, Math.floor(numTickets * 0.3));
    const initialPicks = await this.generateLegacyPredictions(trainingData, initialPicksCount);

    if (initialPicks.length === 0) {
      // If we can't generate initial picks, fallback to legacy
      return await this.generateLegacyPredictions(trainingData, numTickets);
    }

    // Step 2: Get the latest draw from training data (most recent draw)
    // trainingData is sorted with oldest first (from runBacktest), so the latest is at the end
    const latestDraw = trainingData[trainingData.length - 1];
    const latestDrawNumbers = latestDraw.winning_numbers.split(' ');

    if (!latestDrawNumbers || latestDrawNumbers.length !== 6) {
      // Fallback to legacy if latest draw is invalid
      return await this.generateLegacyPredictions(trainingData, numTickets);
    }

    // Step 3: Analyze initial picks against latest draw to identify patterns
    const diffAnalyses = this.diffAnalysisService.analyzePicks(
      initialPicks,
      latestDrawNumbers
    );

    if (!diffAnalyses || diffAnalyses.length === 0) {
      // Fallback to legacy if analysis fails
      return await this.generateLegacyPredictions(trainingData, numTickets);
    }

    // Step 4: Identify patterns from the analysis
    const diffPatternAnalysis = this.diffAnalysisService.identifyPatterns(diffAnalyses);

    if (!diffPatternAnalysis || !diffPatternAnalysis.patterns || diffPatternAnalysis.patterns.length === 0) {
      // Fallback to legacy if no patterns identified
      return await this.generateLegacyPredictions(trainingData, numTickets);
    }

    // Step 5: Build generation context with diff patterns
    const context = this.buildGenerationContextForBacktest(trainingData, diffPatternAnalysis);

    // Step 6: Generate picks using DiffPatternStrategy
    const diffPatternStrategy = this.strategyFactory.getStrategy('diffPattern');
    if (!diffPatternStrategy) {
      // Fallback to legacy if strategy not available
      return await this.generateLegacyPredictions(trainingData, numTickets);
    }

    const diffPatternPicks: string[][] = [];
    const remainingTickets = numTickets - initialPicks.length;

    for (let i = 0; i < remainingTickets; i++) {
      try {
        const pick = await diffPatternStrategy.generate(context);
        if (pick && pick.length === 6) {
          // Ensure proper formatting (zero-padded)
          const formattedPick: string[] = pick.map((num: string) => 
            (num.length === 1 ? `0${num}` : num)
          );
          diffPatternPicks.push(formattedPick);
        }
      } catch (error) {
        console.error(`Error generating diff pattern pick ${i + 1}:`, error);
        // Continue with next iteration
      }
    }

    // Step 7: Combine initial picks with diff pattern picks
    return [...initialPicks, ...diffPatternPicks];
  }

  /**
   * Builds a generation context for strategies in backtest scenarios.
   * This is a simplified version of PowerballService.buildGenerationContext()
   * that works with training data from backtests.
   * 
   * @param trainingData - Historical draws to use for context
   * @param diffPatterns - Optional diff pattern analysis
   * @returns GenerationContext for strategy use
   */
  private buildGenerationContextForBacktest(
    trainingData: PowerballDraw[],
    diffPatterns?: DiffPatternAnalysis
  ): GenerationContext {
    // Convert training data to string[][] format
    const historicalDataStrings: string[][] = trainingData.map(draw => 
      draw.winning_numbers.split(' ').map(num => num.padStart(2, '0'))
    );

    // Build synergy map
    const synergyMap: {
      [positionIndex: number]: {
        [currentNum: string]: { [nextNum: string]: number };
      };
    } = {};

    // Initialize synergy map positions
    for (let i = 0; i < 5; i++) {
      synergyMap[i] = {};
    }

    // Build synergy data from historical draws
    for (const row of historicalDataStrings) {
      if (!row || row.length < 6) continue;
      for (let i = 0; i < 4; i++) {
        const current = row[i];
        const next = row[i + 1];
        if (!current || !next) continue;
        if (!synergyMap[i][current]) {
          synergyMap[i][current] = {};
        }
        if (!synergyMap[i][current][next]) {
          synergyMap[i][current][next] = 0;
        }
        synergyMap[i][current][next]++;
      }
    }

    // Build filtered parsed sets
    const filteredParsedSets: Array<{ key: string; numbers: number[] }> = [];
    const positions = ['first', 'second', 'third', 'fourth', 'fifth', 'powerball'];
    
    for (const position of positions) {
      const numbers: number[] = [];
      const idx = positions.indexOf(position);
      for (const draw of historicalDataStrings) {
        if (idx >= 0 && idx < draw.length) {
          numbers.push(parseInt(draw[idx], 10));
        }
      }
      filteredParsedSets.push({ key: position, numbers });
    }

    // Helper methods (simplified implementations)
    return {
      historicalData: historicalDataStrings,
      filteredParsedSets,
      synergyMap,
      pickAdvancedProbabilityNumber: (bestGuessSet: string[]) => {
        if (!bestGuessSet || bestGuessSet.length === 0) {
          const rand = Math.floor(Math.random() * 69) + 1;
          return rand.toString().padStart(2, '0');
        }
        const frequencies: Record<string, number> = {};
        for (const num of bestGuessSet) {
          frequencies[num] = 0;
        }
        
        for (const draw of historicalDataStrings) {
          for (const num of draw.slice(0, 5)) {
            if (bestGuessSet.includes(num)) {
              frequencies[num] = (frequencies[num] || 0) + 1;
            }
          }
        }

        const weightedArray: string[] = [];
        for (const [num, count] of Object.entries(frequencies)) {
          for (let i = 0; i < (count || 1); i++) {
            weightedArray.push(num);
          }
        }

        return weightedArray.length > 0
          ? weightedArray[Math.floor(Math.random() * weightedArray.length)]
          : bestGuessSet[Math.floor(Math.random() * bestGuessSet.length)];
      },
      pickAdvancedProbabilityNumberWithRecency: (bestGuessSet: string[], recencyThreshold: number) => {
        if (!bestGuessSet || bestGuessSet.length === 0) {
          const rand = Math.floor(Math.random() * 69) + 1;
          return rand.toString().padStart(2, '0');
        }
        const frequencies: Record<string, number> = {};
        for (const num of bestGuessSet) {
          frequencies[num] = 0;
        }
        
        const recentData = historicalDataStrings.slice(-recencyThreshold);
        for (const draw of recentData) {
          for (const num of draw.slice(0, 5)) {
            if (bestGuessSet.includes(num)) {
              frequencies[num] = (frequencies[num] || 0) + 1;
            }
          }
        }

        const weightedArray: string[] = [];
        for (const [num, count] of Object.entries(frequencies)) {
          for (let i = 0; i < (count || 1); i++) {
            weightedArray.push(num);
          }
        }

        return weightedArray.length > 0
          ? weightedArray[Math.floor(Math.random() * weightedArray.length)]
          : bestGuessSet[Math.floor(Math.random() * bestGuessSet.length)];
      },
      pickMostFrequentFirstNumber: (powerball?: boolean) => {
        const index = powerball ? 5 : 0;
        const firstNumbers = historicalDataStrings.map(draw => draw[index] || '01');
        const frequencies: Record<string, number> = {};
        for (const num of firstNumbers) {
          frequencies[num] = (frequencies[num] || 0) + 1;
        }
        let mostFrequent = '01';
        let maxCount = 0;
        for (const [num, count] of Object.entries(frequencies)) {
          if (count > maxCount) {
            maxCount = count;
            mostFrequent = num;
          }
        }
        return mostFrequent;
      },
      pickWeightedRandomFirstNumber: (powerball?: boolean) => {
        const index = powerball ? 5 : 0;
        const firstNumbers = historicalDataStrings.map(draw => draw[index] || '01');
        const frequencies: Record<string, number> = {};
        for (const num of firstNumbers) {
          frequencies[num] = (frequencies[num] || 0) + 1;
        }
        const weightedArray: string[] = [];
        for (const [num, count] of Object.entries(frequencies)) {
          for (let i = 0; i < count; i++) {
            weightedArray.push(num);
          }
        }
        return weightedArray.length > 0
          ? weightedArray[Math.floor(Math.random() * weightedArray.length)]
          : '01';
      },
      generateNextNumberArray: (selectedNumber: string, customIndex?: number) => {
        const index = customIndex || 0;
        const nextNumbers: string[] = [];
        for (const draw of historicalDataStrings) {
          if (draw[index] === selectedNumber && index < 4) {
            nextNumbers.push(draw[index + 1]);
          }
        }
        if (nextNumbers.length === 0) {
          const rand = Math.floor(Math.random() * 69) + 1;
          return [rand.toString().padStart(2, '0')];
        }
        return nextNumbers;
      },
      randomNumberInRange: (min: number, max: number) => {
        const rand = Math.floor(Math.random() * (max - min + 1)) + min;
        return rand.toString().padStart(2, '0');
      },
      buildWithTheFirst: (firstPredictedNumber: string, initialPlay: string[]) => {
        const play = [firstPredictedNumber];
        while (play.length < 5) {
          const nextNum = this.randomNumberInRangeHelper(1, 69);
          if (!play.includes(nextNum)) {
            play.push(nextNum);
          }
        }
        if (play.length === 5) {
          play.push(this.randomNumberInRangeHelper(1, 26));
        }
        return play.length === 6 ? play : [...play.slice(0, 5), this.randomNumberInRangeHelper(1, 26)];
      },
      pickPowerballAi: () => {
        const powerballs = historicalDataStrings.map(draw => draw[5] || '01');
        const frequencies: Record<string, number> = {};
        for (const pb of powerballs) {
          frequencies[pb] = (frequencies[pb] || 0) + 1;
        }
        const weightedArray: string[] = [];
        for (const [pb, count] of Object.entries(frequencies)) {
          for (let i = 0; i < count; i++) {
            weightedArray.push(pb);
          }
        }
        if (weightedArray.length > 0) {
          return weightedArray[Math.floor(Math.random() * weightedArray.length)];
        }
        const rand = Math.floor(Math.random() * 26) + 1;
        return rand.toString().padStart(2, '0');
      },
      generateFallbackSet: () => {
        const fallback: string[] = [];
        for (let i = 0; i < 5; i++) {
          fallback.push(this.randomNumberInRangeHelper(1, 69));
        }
        fallback.push(this.randomNumberInRangeHelper(1, 26));
        return fallback;
      },
      sortGeneratedSet: (generated: string[] | string[][]) => {
        if (Array.isArray(generated) && generated.length > 0) {
          if (Array.isArray(generated[0])) {
            // Array of arrays - sort first array and return it
            return this.sortPlayHelper((generated as string[][])[0]);
          } else if (generated.length === 6) {
            // Single play
            return this.sortPlayHelper(generated as string[]);
          }
        }
        return (generated as string[]).length === 6 ? (generated as string[]) : [];
      },
      diffPatterns: diffPatterns,
    };
  }

  /**
   * Helper method to generate a random number in range as a zero-padded string.
   */
  private randomNumberInRangeHelper(min: number, max: number): string {
    const rand = Math.floor(Math.random() * (max - min + 1)) + min;
    return rand.toString().padStart(2, '0');
  }

  /**
   * Helper method to sort a play: white balls ascending, powerball last.
   */
  private sortPlayHelper(play: string[]): string[] {
    if (!play || play.length !== 6) return play;
    const whiteBalls = play.slice(0, 5)
      .map(num => parseInt(num, 10))
      .sort((a, b) => a - b)
      .map(num => num.toString().padStart(2, '0'));
    return [...whiteBalls, play[5]];
  }

  /**
   * Evaluates how well predictions match the actual draw.
   * Returns the best match across all tickets.
   */
  private evaluateMatch(
    predictions: string[][],
    actualDraw: PowerballDraw
  ): {
    whiteHits: number;
    powerballHit: boolean;
    matchedTicket: string[];
  } {
    const actualNumbers = actualDraw.winning_numbers.split(' ');
    const actualWhites = new Set(actualNumbers.slice(0, 5));
    const actualPowerball = actualNumbers[5];

    let bestMatch = {
      whiteHits: 0,
      powerballHit: false,
      matchedTicket: [] as string[],
    };

    for (const ticket of predictions) {
      if (ticket.length !== 6) continue;

      const ticketWhites = new Set(ticket.slice(0, 5));
      const ticketPowerball = ticket[5];

      // Count white ball matches
      let whiteHits = 0;
      for (const white of ticketWhites) {
        if (actualWhites.has(white)) {
          whiteHits++;
        }
      }

      const powerballHit = ticketPowerball === actualPowerball;

      // Update best match if this is better
      if (
        whiteHits > bestMatch.whiteHits ||
        (whiteHits === bestMatch.whiteHits && powerballHit && !bestMatch.powerballHit)
      ) {
        bestMatch = {
          whiteHits,
          powerballHit,
          matchedTicket: ticket,
        };
      }
    }

    return bestMatch;
  }

  /**
   * Generates summary statistics from all step results.
   */
  private generateSummary(
    stepResults: BacktestStepResult[],
    config: BacktestConfig
  ): BacktestSummary {
    const strategyStats: {
      [strategyName: string]: {
        totalWhiteHits: number;
        totalPowerballHits: number;
        bestWhiteHits: number;
        worstWhiteHits: number;
        perfectMatches: number;
        nearMisses: number;
        fourWhiteMatches: number;
        threeWhitePowerballMatches: number;
        stepCount: number;
      };
    } = {};

    let totalPredictions = 0;
    let totalTickets = 0;

    // Initialize stats for each strategy
    const allStrategies = new Set<string>();
    stepResults.forEach((step) => {
      step.predictions.forEach((pred) => {
        allStrategies.add(pred.strategy);
        if (!strategyStats[pred.strategy]) {
          strategyStats[pred.strategy] = {
            totalWhiteHits: 0,
            totalPowerballHits: 0,
            bestWhiteHits: 0,
            worstWhiteHits: 5,
            perfectMatches: 0,
            nearMisses: 0,
            fourWhiteMatches: 0,
            threeWhitePowerballMatches: 0,
            stepCount: 0,
          };
        }
      });
    });

    // Aggregate statistics
    stepResults.forEach((step) => {
      step.predictions.forEach((pred) => {
        const stats = strategyStats[pred.strategy];
        const match = pred.bestMatch;

        stats.totalWhiteHits += match.whiteHits;
        stats.totalPowerballHits += match.powerballHit ? 1 : 0;
        stats.bestWhiteHits = Math.max(stats.bestWhiteHits, match.whiteHits);
        stats.worstWhiteHits = Math.min(stats.worstWhiteHits, match.whiteHits);
        stats.stepCount++;

        // Perfect match: 5 white + powerball
        if (match.whiteHits === 5 && match.powerballHit) {
          stats.perfectMatches++;
        }

        // Near miss: 4 white + powerball, or 5 white
        if (
          (match.whiteHits === 4 && match.powerballHit) ||
          (match.whiteHits === 5)
        ) {
          stats.nearMisses++;
        }

        // Target win: Exactly 4 white matches (regardless of powerball)
        if (match.whiteHits === 4) {
          stats.fourWhiteMatches++;
        }

        // Target win: Exactly 3 white matches + powerball match
        if (match.whiteHits === 3 && match.powerballHit) {
          stats.threeWhitePowerballMatches++;
        }

        totalTickets += pred.tickets.length;
        totalPredictions++;
      });
    });

    // Calculate averages
    const summaryStrategies: BacktestSummary['strategies'] = {};
    Object.keys(strategyStats).forEach((strategy) => {
      const stats = strategyStats[strategy];
      summaryStrategies[strategy] = {
        totalWhiteHits: stats.totalWhiteHits,
        totalPowerballHits: stats.totalPowerballHits,
        averageWhiteHits: stats.stepCount > 0 ? stats.totalWhiteHits / stats.stepCount : 0,
        averagePowerballHits: stats.stepCount > 0 ? stats.totalPowerballHits / stats.stepCount : 0,
        bestWhiteHits: stats.bestWhiteHits,
        worstWhiteHits: stats.worstWhiteHits,
        perfectMatches: stats.perfectMatches,
        nearMisses: stats.nearMisses,
        fourWhiteMatches: stats.fourWhiteMatches,
        threeWhitePowerballMatches: stats.threeWhitePowerballMatches,
      };
    });

    return {
      totalSteps: stepResults.length,
      strategies: summaryStrategies,
      overallMetrics: {
        totalPredictions,
        averageTicketsPerStep: stepResults.length > 0 ? totalTickets / stepResults.length : 0,
        totalTestDraws: stepResults.length,
      },
    };
  }

  /**
   * Formats backtest results for console output (useful for debugging).
   */
  formatResultsForConsole(result: BacktestResult): string {
    let output = '\n=== BACKTEST RESULTS ===\n\n';
    output += `Configuration:\n`;
    output += `  Initial Training Size: ${result.config.initialTrainingSize}\n`;
    output += `  Step Size: ${result.config.stepSize}\n`;
    output += `  Holdout Size: ${result.config.holdoutSize}\n`;
    output += `  Strategies: ${result.config.strategies.join(', ')}\n`;
    output += `  Tickets per Strategy: ${result.config.ticketsPerStrategy}\n\n`;

    output += `Summary:\n`;
    output += `  Total Steps: ${result.summary.totalSteps}\n`;
    output += `  Total Test Draws: ${result.summary.overallMetrics.totalTestDraws}\n`;
    output += `  Average Tickets per Step: ${result.summary.overallMetrics.averageTicketsPerStep.toFixed(2)}\n\n`;

    output += `Strategy Performance:\n`;
    Object.keys(result.summary.strategies).forEach((strategy) => {
      const stats = result.summary.strategies[strategy];
      output += `  ${strategy.toUpperCase()}:\n`;
      output += `    Average White Hits: ${stats.averageWhiteHits.toFixed(2)}\n`;
      output += `    Average Powerball Hits: ${stats.averagePowerballHits.toFixed(2)}\n`;
      output += `    Best White Hits: ${stats.bestWhiteHits}\n`;
      output += `    Worst White Hits: ${stats.worstWhiteHits}\n`;
      output += `    Perfect Matches (5+PB): ${stats.perfectMatches}\n`;
      output += `    Near Misses (4+PB or 5): ${stats.nearMisses}\n`;
      output += `    Target Wins - 4 White Matches: ${stats.fourWhiteMatches}\n`;
      output += `    Target Wins - 3 White + Powerball: ${stats.threeWhitePowerballMatches}\n\n`;
    });

    return output;
  }

  /**
   * Exports backtest results to JSON format.
   */
  exportToJson(result: BacktestResult): string {
    return JSON.stringify(result, null, 2);
  }

  /**
   * Convenience method to run a quick backtest with sensible defaults.
   * Useful for quick validation or testing.
   * 
   * @param options Optional overrides for default configuration
   * @returns Backtest results
   */
  async runQuickBacktest(
    options: {
      strategies?: string[];
      maxSteps?: number;
      initialTrainingSize?: number;
      ticketsPerStrategy?: number;
    } = {}
  ): Promise<BacktestResult> {
    return this.runBacktest({
      initialTrainingSize: options.initialTrainingSize || 100,
      stepSize: 1,
      holdoutSize: 1,
      minTrainingSize: 50,
      strategies: options.strategies || ['legacy', 'prediction'],
      ticketsPerStrategy: options.ticketsPerStrategy || 10,
      maxSteps: options.maxSteps || 20, // Limit steps for quick tests
    });
  }
}
