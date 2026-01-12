import { Injectable } from '@angular/core';
import { GenerationStrategy, GenerationContext } from './generation-strategy.interface';
import {
  StrategyResult,
  EnsembleConfig,
  EnsembleResult,
  PortfolioMetrics,
  StrategyName,
} from '../../models/powerball-draw.interface';
import { BacktestStepResult } from '../backtest.service';

/**
 * Ensemble Strategy
 * 
 * Generates tickets by combining all existing strategies (legacy, prediction, ai, diffPattern)
 * using weighted frequency distributions and greedy ticket generation with diversity penalties.
 */
@Injectable({
  providedIn: 'root',
})
export class EnsembleStrategy implements GenerationStrategy {
  getName(): string {
    return 'Ensemble';
  }

  /**
   * Generates a single ticket using ensemble method.
   * Note: This is called for single-ticket generation, but ensemble typically generates multiple tickets.
   * For backtest usage, use generateEnsembleTickets() directly.
   */
  async generate(context: GenerationContext): Promise<string[]> {
    // For single ticket generation, we'd need to call all base strategies first
    // This is a simplified fallback - in practice, use generateEnsembleTickets()
    return context.generateFallbackSet();
  }

  /**
   * Generates ensemble tickets from strategy results.
   * This is the main entry point for ensemble generation.
   */
  async generateEnsembleTickets(
    strategyResults: StrategyResult[],
    config: EnsembleConfig
  ): Promise<EnsembleResult> {
    // Filter out strategies with no tickets
    const validResults = strategyResults.filter(r => r.tickets && r.tickets.length > 0);
    
    if (validResults.length === 0) {
      throw new Error('No valid strategy results provided for ensemble generation');
    }

    // Normalize weights for available strategies
    const normalizedWeights = this.normalizeWeights(config.weights, validResults);

    // Build frequency distributions for each strategy
    const frequencyDists = this.buildFrequencyDistributions(validResults);

    // Blend probabilities
    const blendedProbs = this.blendProbabilities(frequencyDists, normalizedWeights);

    // Identify consensus numbers if enabled
    const consensusNumbers = config.consensus.enabled
      ? this.identifyConsensusNumbers(validResults, config.consensus.topK, config.consensus.minStrategies)
      : [];

    // Generate tickets
    const tickets = this.generateTickets(
      blendedProbs,
      config,
      consensusNumbers,
      validResults
    );

    // Calculate portfolio metrics
    const portfolioMetrics = this.calculatePortfolioMetrics(tickets, blendedProbs);

    // Track strategy contributions
    const strategyContributions = this.trackStrategyContributions(tickets, validResults, consensusNumbers);

    // Calculate ticket scores (expected hit proxy per ticket)
    const ticketScores = tickets.map(ticket => {
      const whiteScore = ticket.slice(0, 5).reduce((sum, num) => {
        const n = parseInt(num, 10);
        return sum + (blendedProbs.white[n - 1] || 0);
      }, 0);
      const pbNum = parseInt(ticket[5], 10);
      const pbScore = blendedProbs.powerball[pbNum - 1] || 0;
      return whiteScore + pbScore;
    });

    return {
      strategy: 'ensemble',
      tickets,
      ticketScores,
      portfolioMetrics,
      strategyContributions,
      blendedProbabilities: blendedProbs,
      metadata: {
        weightsUsed: normalizedWeights,
        consensusNumbers: consensusNumbers.length > 0 ? consensusNumbers : undefined,
      },
    };
  }

  /**
   * Builds frequency distributions from strategy results.
   */
  private buildFrequencyDistributions(
    strategyResults: StrategyResult[]
  ): Map<StrategyName, { white: number[]; powerball: number[] }> {
    const distributions = new Map<StrategyName, { white: number[]; powerball: number[] }>();

    for (const result of strategyResults) {
      // Initialize frequency arrays
      const whiteFreq = new Array(69).fill(0);
      const pbFreq = new Array(26).fill(0);

      // Count frequencies from tickets
      for (const ticket of result.tickets) {
        if (ticket.length !== 6) continue;

        // Count white balls (first 5)
        for (let i = 0; i < 5; i++) {
          const num = parseInt(ticket[i], 10);
          if (num >= 1 && num <= 69) {
            whiteFreq[num - 1]++;
          }
        }

        // Count powerball (last)
        const pbNum = parseInt(ticket[5], 10);
        if (pbNum >= 1 && pbNum <= 26) {
          pbFreq[pbNum - 1]++;
        }
      }

      distributions.set(result.strategy, { white: whiteFreq, powerball: pbFreq });
    }

    return distributions;
  }

  /**
   * Blends probability distributions from multiple strategies using weights.
   */
  private blendProbabilities(
    frequencyDists: Map<StrategyName, { white: number[]; powerball: number[] }>,
    weights: EnsembleConfig['weights']
  ): { white: number[]; powerball: number[] } {
    const blendedWhite = new Array(69).fill(0);
    const blendedPB = new Array(26).fill(0);

    // Normalize each strategy's frequencies first
    const normalizedDists = new Map<StrategyName, { white: number[]; powerball: number[] }>();

    for (const [strategy, dist] of frequencyDists.entries()) {
      const whiteSum = dist.white.reduce((a, b) => a + b, 0);
      const pbSum = dist.powerball.reduce((a, b) => a + b, 0);

      const normWhite = whiteSum > 0
        ? dist.white.map(f => f / whiteSum)
        : new Array(69).fill(1 / 69);
      const normPB = pbSum > 0
        ? dist.powerball.map(f => f / pbSum)
        : new Array(26).fill(1 / 26);

      normalizedDists.set(strategy, { white: normWhite, powerball: normPB });
    }

    // Blend using weights
    for (const [strategy, dist] of normalizedDists.entries()) {
      const weight = this.getStrategyWeight(strategy, weights);
      
      for (let i = 0; i < 69; i++) {
        blendedWhite[i] += weight * dist.white[i];
      }
      
      for (let i = 0; i < 26; i++) {
        blendedPB[i] += weight * dist.powerball[i];
      }
    }

    return { white: blendedWhite, powerball: blendedPB };
  }

  /**
   * Gets weight for a strategy from config.
   */
  private getStrategyWeight(strategy: StrategyName, weights: EnsembleConfig['weights']): number {
    switch (strategy) {
      case 'legacy':
        return weights.legacy;
      case 'prediction':
        return weights.prediction;
      case 'ai':
        return weights.ai;
      case 'diffPattern':
        return weights.diffPattern;
      default:
        return 0;
    }
  }

  /**
   * Normalizes weights for available strategies only.
   */
  private normalizeWeights(
    weights: EnsembleConfig['weights'],
    validResults: StrategyResult[]
  ): EnsembleConfig['weights'] {
    const availableStrategies = new Set(validResults.map(r => r.strategy));
    
    let totalWeight = 0;
    if (availableStrategies.has('legacy')) totalWeight += weights.legacy;
    if (availableStrategies.has('prediction')) totalWeight += weights.prediction;
    if (availableStrategies.has('ai')) totalWeight += weights.ai;
    if (availableStrategies.has('diffPattern')) totalWeight += weights.diffPattern;

    if (totalWeight === 0) {
      // Fallback to equal weights
      const equalWeight = 1 / availableStrategies.size;
      return {
        legacy: availableStrategies.has('legacy') ? equalWeight : 0,
        prediction: availableStrategies.has('prediction') ? equalWeight : 0,
        ai: availableStrategies.has('ai') ? equalWeight : 0,
        diffPattern: availableStrategies.has('diffPattern') ? equalWeight : 0,
      };
    }

    return {
      legacy: availableStrategies.has('legacy') ? weights.legacy / totalWeight : 0,
      prediction: availableStrategies.has('prediction') ? weights.prediction / totalWeight : 0,
      ai: availableStrategies.has('ai') ? weights.ai / totalWeight : 0,
      diffPattern: availableStrategies.has('diffPattern') ? weights.diffPattern / totalWeight : 0,
    };
  }

  /**
   * Generates tickets using greedy algorithm with reuse penalty.
   * Optimized for performance with caching and efficient selection.
   */
  private generateTickets(
    blendedProbs: { white: number[]; powerball: number[] },
    config: EnsembleConfig,
    consensusNumbers: number[],
    strategyResults: StrategyResult[]
  ): string[][] {
    // Validate inputs
    if (config.ticketCount <= 0) {
      return [];
    }

    const tickets: string[][] = [];
    const reuseCountWhite = new Array(69).fill(0);
    const reuseCountPB = new Array(26).fill(0);

    // Initialize random seed if deterministic
    // Include config hash in seed for different configs to produce different results
    let randomSeed = config.deterministic.enabled && config.deterministic.seed
      ? config.deterministic.seed + this.hashConfig(config)
      : Math.random() * 1000000;

    // Simple seeded random function (linear congruential generator)
    const seededRandom = () => {
      randomSeed = (randomSeed * 9301 + 49297) % 233280;
      return randomSeed / 233280;
    };

    const getRandom = config.deterministic.enabled ? seededRandom : Math.random;

    // Pre-calculate pattern bonus functions to avoid repeated calculations
    const patternBonusCache = new Map<string, number>();

    for (let ticketIndex = 0; ticketIndex < config.ticketCount; ticketIndex++) {
      const currentTicket: number[] = [];

      // Inject consensus numbers if enabled
      if (config.consensus.enabled && consensusNumbers.length > 0) {
        const injectCount = Math.min(
          config.consensus.injectCount,
          consensusNumbers.length,
          5 - currentTicket.length
        );
        
        // Shuffle consensus numbers for variety (using seeded random if deterministic)
        const shuffled = [...consensusNumbers].sort(() => getRandom() - 0.5);
        
        for (let i = 0; i < injectCount && currentTicket.length < 5; i++) {
          const num = shuffled[i];
          if (!currentTicket.includes(num)) {
            currentTicket.push(num);
            reuseCountWhite[num - 1]++;
          }
        }
      }

      // Fill remaining white ball slots
      // Optimize: Use priority-based selection for better performance
      while (currentTicket.length < 5) {
        let bestNum = 1;
        let bestScore = -Infinity;

        // Optimize: Only check numbers not already in ticket
        for (let n = 1; n <= 69; n++) {
          if (currentTicket.includes(n)) continue;

          const prob = blendedProbs.white[n - 1] || 0;
          const reusePenalty = config.reusePenalty.white * reuseCountWhite[n - 1];
          
          // Cache key for pattern bonus
          const cacheKey = `${n}-${currentTicket.join(',')}`;
          let patternBonus = patternBonusCache.get(cacheKey);
          
          if (patternBonus === undefined) {
            patternBonus = 0;
            // Apply pattern bonuses if enabled
            if (config.constraints.evenOddBalance) {
              patternBonus += this.calculateEvenOddBonus(n, currentTicket);
            }
            if (config.constraints.lowHighSplit) {
              patternBonus += this.calculateLowHighBonus(n, currentTicket);
            }
            if (config.constraints.sumRange) {
              patternBonus += this.calculateSumBonus(n, currentTicket);
            }
            if (config.constraints.diffPatternAlignment) {
              // Note: diffPattern context would need to be passed in for this to work
              // For now, this is a placeholder - can be enhanced later
              patternBonus += 0; // Placeholder
            }
            patternBonusCache.set(cacheKey, patternBonus);
          }

          const score = prob - reusePenalty + patternBonus;

          if (score > bestScore) {
            bestScore = score;
            bestNum = n;
          }
        }

        // Validate selected number
        if (bestNum < 1 || bestNum > 69) {
          console.warn(`Invalid number selected: ${bestNum}, using fallback`);
          // Fallback: pick first available number
          for (let n = 1; n <= 69; n++) {
            if (!currentTicket.includes(n)) {
              bestNum = n;
              break;
            }
          }
        }

        currentTicket.push(bestNum);
        reuseCountWhite[bestNum - 1]++;
      }

      // Select powerball
      let bestPB = 1;
      let bestPBScore = -Infinity;

      for (let p = 1; p <= 26; p++) {
        const prob = blendedProbs.powerball[p - 1] || 0;
        const reusePenalty = config.reusePenalty.powerball * reuseCountPB[p - 1];
        const score = prob - reusePenalty;

        if (score > bestPBScore) {
          bestPBScore = score;
          bestPB = p;
        }
      }

      // Validate powerball
      if (bestPB < 1 || bestPB > 26) {
        console.warn(`Invalid powerball selected: ${bestPB}, using fallback`);
        bestPB = 1; // Fallback
      }

      currentTicket.push(bestPB);
      reuseCountPB[bestPB - 1]++;

      // Sort whites ascending, format as strings
      const whites = currentTicket.slice(0, 5).sort((a, b) => a - b);
      const pb = currentTicket[5];
      
      // Validate ticket before adding
      if (whites.length === 5 && pb >= 1 && pb <= 26) {
        // Check for uniqueness of whites
        const uniqueWhites = new Set(whites);
        if (uniqueWhites.size === 5) {
          const formattedTicket = [
            ...whites.map(n => n.toString().padStart(2, '0')),
            pb.toString().padStart(2, '0'),
          ];
          tickets.push(formattedTicket);
        } else {
          console.warn(`Duplicate whites in ticket, skipping: ${whites.join(',')}`);
        }
      } else {
        console.warn(`Invalid ticket generated, skipping: whites=${whites.length}, pb=${pb}`);
      }
    }

    // Clear cache for next ticket generation
    patternBonusCache.clear();

    return tickets;
  }

  /**
   * Simple hash function for config to ensure different configs produce different seeds.
   */
  private hashConfig(config: EnsembleConfig): number {
    const str = JSON.stringify({
      weights: config.weights,
      constraints: config.constraints,
      consensus: config.consensus,
    });
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Calculates even/odd balance bonus.
   */
  private calculateEvenOddBonus(n: number, currentTicket: number[]): number {
    const currentEvenCount = currentTicket.filter(num => num % 2 === 0).length;
    const currentOddCount = currentTicket.length - currentEvenCount;
    const isEven = n % 2 === 0;

    if (currentEvenCount < 2 && isEven) return 0.05;
    if (currentOddCount < 2 && !isEven) return 0.05;
    if (currentEvenCount >= 3 && isEven) return -0.02;
    if (currentOddCount >= 3 && !isEven) return -0.02;

    return 0;
  }

  /**
   * Calculates low/high split bonus.
   */
  private calculateLowHighBonus(n: number, currentTicket: number[]): number {
    const lowCount = currentTicket.filter(num => num <= 34).length;
    const highCount = currentTicket.length - lowCount;

    if (lowCount < 2 && n <= 34) return 0.03;
    if (highCount < 2 && n >= 35) return 0.03;

    return 0;
  }

  /**
   * Calculates sum range bonus.
   */
  private calculateSumBonus(n: number, currentTicket: number[]): number {
    const currentSum = currentTicket.reduce((a, b) => a + b, 0);
    const projectedSum = currentSum + n;

    if (projectedSum < 100) {
      return -0.01 * (100 - projectedSum) / 10;
    }
    if (projectedSum > 200) {
      return -0.01 * (projectedSum - 200) / 10;
    }

    return 0;
  }

  /**
   * Identifies consensus numbers across strategies.
   */
  private identifyConsensusNumbers(
    strategyResults: StrategyResult[],
    topK: number,
    minStrategies: number
  ): number[] {
    // Build frequency distributions to find top-K per strategy
    const topKPerStrategy = new Map<StrategyName, number[]>();

    for (const result of strategyResults) {
      const whiteFreq = new Array(69).fill(0);
      
      for (const ticket of result.tickets) {
        if (ticket.length !== 6) continue;
        for (let i = 0; i < 5; i++) {
          const num = parseInt(ticket[i], 10);
          if (num >= 1 && num <= 69) {
            whiteFreq[num - 1]++;
          }
        }
      }

      // Get top-K numbers (by frequency)
      const indexed = whiteFreq.map((freq, idx) => ({ num: idx + 1, freq }));
      indexed.sort((a, b) => b.freq - a.freq);
      const topKNumbers = indexed.slice(0, topK).map(item => item.num);
      
      topKPerStrategy.set(result.strategy, topKNumbers);
    }

    // Count how many strategies include each number
    const consensusCount = new Array(69).fill(0);
    for (const topKNumbers of topKPerStrategy.values()) {
      for (const num of topKNumbers) {
        consensusCount[num - 1]++;
      }
    }

    // Return numbers that appear in at least minStrategies
    const consensusNumbers: number[] = [];
    for (let i = 0; i < 69; i++) {
      if (consensusCount[i] >= minStrategies) {
        consensusNumbers.push(i + 1);
      }
    }

    // Sort by consensus count (descending)
    consensusNumbers.sort((a, b) => consensusCount[b - 1] - consensusCount[a - 1]);

    return consensusNumbers;
  }

  /**
   * Calculates portfolio metrics.
   */
  private calculatePortfolioMetrics(
    tickets: string[][],
    blendedProbs: { white: number[]; powerball: number[] }
  ): PortfolioMetrics {
    // Unique whites
    const uniqueWhites = new Set<number>();
    const reuseCountWhite = new Array(69).fill(0);

    for (const ticket of tickets) {
      if (ticket.length !== 6) continue;
      for (let i = 0; i < 5; i++) {
        const num = parseInt(ticket[i], 10);
        if (num >= 1 && num <= 69) {
          uniqueWhites.add(num);
          reuseCountWhite[num - 1]++;
        }
      }
    }

    const maxReuse = Math.max(...reuseCountWhite, 0);
    const coverageRatio = uniqueWhites.size / 69;
    const concentrationScore = tickets.length > 0 ? maxReuse / tickets.length : 0;

    // Expected hit proxy
    let totalExpectedHit = 0;
    for (const ticket of tickets) {
      if (ticket.length !== 6) continue;
      let ticketScore = 0;
      for (let i = 0; i < 5; i++) {
        const num = parseInt(ticket[i], 10);
        if (num >= 1 && num <= 69) {
          ticketScore += blendedProbs.white[num - 1] || 0;
        }
      }
      const pbNum = parseInt(ticket[5], 10);
      if (pbNum >= 1 && pbNum <= 26) {
        ticketScore += blendedProbs.powerball[pbNum - 1] || 0;
      }
      totalExpectedHit += ticketScore;
    }

    const expectedHitProxy = tickets.length > 0 ? totalExpectedHit / tickets.length : 0;

    return {
      uniqueWhites: uniqueWhites.size,
      coverageRatio,
      maxReuse,
      concentrationScore,
      expectedHitProxy,
    };
  }

  /**
   * Tracks which strategies contributed numbers to each ticket.
   */
  private trackStrategyContributions(
    tickets: string[][],
    strategyResults: StrategyResult[],
    consensusNumbers: number[]
  ): { [ticketIndex: number]: { [strategy: string]: number } } {
    const contributions: { [ticketIndex: number]: { [strategy: string]: number } } = {};

    // Build top-K numbers per strategy for contribution tracking
    const topKPerStrategy = new Map<StrategyName, Set<number>>();
    const topK = 15; // Use a reasonable top-K for contribution tracking

    for (const result of strategyResults) {
      const whiteFreq = new Array(69).fill(0);
      
      for (const ticket of result.tickets) {
        if (ticket.length !== 6) continue;
        for (let i = 0; i < 5; i++) {
          const num = parseInt(ticket[i], 10);
          if (num >= 1 && num <= 69) {
            whiteFreq[num - 1]++;
          }
        }
      }

      const indexed = whiteFreq.map((freq, idx) => ({ num: idx + 1, freq }));
      indexed.sort((a, b) => b.freq - a.freq);
      const topKNumbers = new Set(indexed.slice(0, topK).map(item => item.num));
      topKPerStrategy.set(result.strategy, topKNumbers);
    }

    // Track contributions per ticket
    for (let ticketIndex = 0; ticketIndex < tickets.length; ticketIndex++) {
      const ticket = tickets[ticketIndex];
      if (ticket.length !== 6) continue;

      const ticketContributions: { [strategy: string]: number } = {};

      for (let i = 0; i < 5; i++) {
        const num = parseInt(ticket[i], 10);
        if (num < 1 || num > 69) continue;

        // Check if number is consensus (appears in multiple strategies)
        const isConsensus = consensusNumbers.includes(num);

        // Count which strategies contributed this number
        for (const [strategy, topKSet] of topKPerStrategy.entries()) {
          if (topKSet.has(num)) {
            ticketContributions[strategy] = (ticketContributions[strategy] || 0) + 1;
          }
        }
      }

      contributions[ticketIndex] = ticketContributions;
    }

    return contributions;
  }

  /**
   * Calculates weights using windowed average method.
   */
  calculateWindowedWeights(
    stepResults: BacktestStepResult[],
    windowSize: number = 10
  ): EnsembleConfig['weights'] {
    const effectiveWindowSize = Math.min(windowSize, stepResults.length);
    const recentSteps = stepResults.slice(-effectiveWindowSize);

    const performance: { [strategy: string]: number[] } = {
      legacy: [],
      prediction: [],
      ai: [],
      diffPattern: [],
    };

    // Collect performance data
    for (const step of recentSteps) {
      for (const pred of step.predictions) {
        const strategy = pred.strategy as keyof typeof performance;
        if (performance[strategy] !== undefined) {
          const perf = pred.bestMatch.whiteHits + (pred.bestMatch.powerballHit ? 0.5 : 0);
          performance[strategy].push(perf);
        }
      }
    }

    // Calculate average performance per strategy
    const avgPerformance: { [strategy: string]: number } = {};
    let totalAvg = 0;

    for (const [strategy, perfs] of Object.entries(performance)) {
      const avg = perfs.length > 0
        ? perfs.reduce((a, b) => a + b, 0) / perfs.length
        : 0;
      avgPerformance[strategy] = avg;
      totalAvg += avg;
    }

    // Normalize to weights (proportional to performance)
    if (totalAvg === 0) {
      // Fallback to equal weights
      return {
        legacy: 0.25,
        prediction: 0.25,
        ai: 0.25,
        diffPattern: 0.25,
      };
    }

    return {
      legacy: avgPerformance['legacy'] / totalAvg,
      prediction: avgPerformance['prediction'] / totalAvg,
      ai: avgPerformance['ai'] / totalAvg,
      diffPattern: avgPerformance['diffPattern'] / totalAvg,
    };
  }

  /**
   * Calculates weights using exponential moving average (EMA) method.
   */
  calculateEMAWeights(
    stepResults: BacktestStepResult[],
    alpha: number = 0.3
  ): EnsembleConfig['weights'] {
    let emaWeights: { [strategy: string]: number } = {
      legacy: 0.25,
      prediction: 0.25,
      ai: 0.25,
      diffPattern: 0.25,
    };

    // Update EMA for each step
    for (const step of stepResults) {
      const currentPerformance: { [strategy: string]: number } = {
        legacy: 0,
        prediction: 0,
        ai: 0,
        diffPattern: 0,
      };

      for (const pred of step.predictions) {
        const strategy = pred.strategy as keyof typeof currentPerformance;
        if (currentPerformance[strategy] !== undefined) {
          currentPerformance[strategy] = pred.bestMatch.whiteHits + (pred.bestMatch.powerballHit ? 0.5 : 0);
        }
      }

      // Update EMA
      for (const strategy of Object.keys(emaWeights) as Array<keyof typeof emaWeights>) {
        emaWeights[strategy] = alpha * currentPerformance[strategy] + (1 - alpha) * emaWeights[strategy];
      }
    }

    // Normalize
    const total = Object.values(emaWeights).reduce((a, b) => a + b, 0);
    if (total === 0) {
      return {
        legacy: 0.25,
        prediction: 0.25,
        ai: 0.25,
        diffPattern: 0.25,
      };
    }

    return {
      legacy: emaWeights['legacy'] / total,
      prediction: emaWeights['prediction'] / total,
      ai: emaWeights['ai'] / total,
      diffPattern: emaWeights['diffPattern'] / total,
    };
  }

  /**
   * Calculates weights using Bayesian smoothing method.
   */
  calculateBayesianWeights(
    stepResults: BacktestStepResult[],
    priorStrength: number = 4
  ): EnsembleConfig['weights'] {
    const priorWeight = 0.25; // Equal prior
    const windowSize = Math.min(10, stepResults.length);
    const recentSteps = stepResults.slice(-windowSize);

    const performance: { [strategy: string]: number[] } = {
      legacy: [],
      prediction: [],
      ai: [],
      diffPattern: [],
    };

    // Collect performance data
    for (const step of recentSteps) {
      for (const pred of step.predictions) {
        const strategy = pred.strategy as keyof typeof performance;
        if (performance[strategy] !== undefined) {
          const perf = pred.bestMatch.whiteHits + (pred.bestMatch.powerballHit ? 0.5 : 0);
          performance[strategy].push(perf);
        }
      }
    }

    // Calculate observed average performance
    const observedAvg: { [strategy: string]: number } = {};
    for (const [strategy, perfs] of Object.entries(performance)) {
      observedAvg[strategy] = perfs.length > 0
        ? perfs.reduce((a, b) => a + b, 0) / perfs.length
        : 0;
    }

    // Bayesian update: (prior * priorStrength + observed * N) / (priorStrength + N)
    const bayesianWeights: { [strategy: string]: number } = {};
    for (const strategy of Object.keys(observedAvg)) {
      bayesianWeights[strategy] = (priorWeight * priorStrength + observedAvg[strategy] * windowSize) /
        (priorStrength + windowSize);
    }

    // Normalize
    const total = Object.values(bayesianWeights).reduce((a, b) => a + b, 0);
    if (total === 0) {
      return {
        legacy: 0.25,
        prediction: 0.25,
        ai: 0.25,
        diffPattern: 0.25,
      };
    }

    return {
      legacy: bayesianWeights['legacy'] / total,
      prediction: bayesianWeights['prediction'] / total,
      ai: bayesianWeights['ai'] / total,
      diffPattern: bayesianWeights['diffPattern'] / total,
    };
  }

  /**
   * Calculates learned weights based on config method.
   */
  calculateLearnedWeights(
    stepResults: BacktestStepResult[],
    config: EnsembleConfig
  ): EnsembleConfig['weights'] {
    if (!config.weightLearning.enabled) {
      return config.weights;
    }

    switch (config.weightLearning.method) {
      case 'windowed':
        return this.calculateWindowedWeights(
          stepResults,
          config.weightLearning.windowSize || 10
        );
      case 'ema':
        return this.calculateEMAWeights(
          stepResults,
          config.weightLearning.alpha || 0.3
        );
      case 'bayesian':
        return this.calculateBayesianWeights(
          stepResults,
          config.weightLearning.priorStrength || 4
        );
      case 'equal':
      default:
        return {
          legacy: 0.25,
          prediction: 0.25,
          ai: 0.25,
          diffPattern: 0.25,
        };
    }
  }
}
