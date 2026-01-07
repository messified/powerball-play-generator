import { Injectable } from '@angular/core';
import { PowerballService } from './powerball.service';
import { PredictionService } from './prediction.service';
import { AiPowerballService } from './ai-powerball.service';
import { PowerballConfigService } from './powerball-config.service';
import { PowerballDataMinusLatest } from '../data/historical-data';

export interface PowerballDraw {
  draw_date: string;
  winning_numbers: string;
  multiplier: string;
}

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
    private configService: PowerballConfigService
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
    historicalData: PowerballDraw[] = PowerballDataMinusLatest
  ): Promise<BacktestResult> {
    const fullConfig: BacktestConfig = {
      initialTrainingSize: 100,
      stepSize: 1,
      holdoutSize: 1,
      minTrainingSize: 50,
      strategies: ['all'],
      ticketsPerStrategy: 20,
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

      // Generate predictions for all strategies
      const predictions = await this.generatePredictionsForStrategies(
        trainingData,
        fullConfig
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
    config: BacktestConfig
  ): Promise<{ strategy: string; tickets: string[][] }[]> {
    const strategies: { strategy: string; tickets: string[][] }[] = [];
    const strategyList = this.resolveStrategies(config.strategies);

    for (const strategyName of strategyList) {
      try {
        const tickets = await this.generateStrategyPredictions(
          strategyName,
          trainingData,
          config.ticketsPerStrategy
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
      return ['legacy', 'prediction', 'ai'];
    }
    return strategyConfig;
  }

  /**
   * Generates predictions for a specific strategy using only training data.
   */
  private async generateStrategyPredictions(
    strategyName: string,
    trainingData: PowerballDraw[],
    numTickets: number
  ): Promise<string[][]> {
    switch (strategyName) {
      case 'legacy':
        return this.generateLegacyPredictions(trainingData, numTickets);
      case 'prediction':
        return this.generatePredictionServicePredictions(trainingData, numTickets);
      case 'ai':
        return this.generateAiPredictions(trainingData, numTickets);
      default:
        throw new Error(`Unknown strategy: ${strategyName}`);
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
      output += `    Near Misses (4+PB or 5): ${stats.nearMisses}\n\n`;
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
