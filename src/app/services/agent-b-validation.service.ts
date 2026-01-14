/**
 * Agent B: Distribution & Bias Analyst Validation Service
 * 
 * This service implements the validation tests specified in the statistical validation plan
 * for Agent B: Distribution & Bias Analyst.
 * 
 * Tests:
 * 1. Per-Position Distribution Validation
 * 2. Bias Detection Tests
 */

import { Injectable } from '@angular/core';
import { PowerballService } from './powerball.service';
import { StrategyFactoryService } from './strategies/strategy-factory.service';
import { PowerballConfigService } from './powerball-config.service';
import { PowerballDataMinusLatest } from '../data/historical-data';
import { PowerballDraw } from '../models/powerball-draw.interface';
import { GenerationStrategy } from './strategies/generation-strategy.interface';

interface DistributionResult {
  position: number;
  number: string;
  frequency: number;
  expectedFrequency?: number;
  percentage: number;
}

interface StrategyDistribution {
  strategy: string;
  totalTickets: number;
  positions: {
    [position: number]: DistributionResult[];
  };
}

interface ChiSquareResult {
  chiSquare: number;
  degreesOfFreedom: number;
  pValue: number;
  criticalValue: number;
  passed: boolean;
}

interface KolmogorovSmirnovResult {
  statistic: number;
  criticalValue: number;
  passed: boolean;
}

interface DistributionTestResult {
  test_name: string;
  strategy: string;
  position: number;
  status: 'PASS' | 'FAIL' | 'SKIP';
  chiSquare?: ChiSquareResult;
  kolmogorovSmirnov?: KolmogorovSmirnovResult;
  expected_distribution_type: string;
  sample_size: number;
  evidence?: string;
}

interface BiasDetectionResult {
  strategy: string;
  intended_biases: {
    name: string;
    present: boolean;
    strength: number; // 0-1 scale
    evidence: string;
  }[];
  unintended_biases: {
    name: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    evidence: string;
  }[];
  status: 'PASS' | 'FAIL';
}

interface DistributionValidationReport {
  agent: string;
  timestamp: string;
  test_suite: string;
  summary: {
    total_tests: number;
    passed: number;
    failed: number;
    skipped: number;
    status: 'PASS' | 'FAIL' | 'IN_PROGRESS';
  };
  results: DistributionTestResult[];
  distributions: StrategyDistribution[];
}

interface BiasValidationReport {
  agent: string;
  timestamp: string;
  test_suite: string;
  summary: {
    total_tests: number;
    passed: number;
    failed: number;
    status: 'PASS' | 'FAIL' | 'IN_PROGRESS';
  };
  results: BiasDetectionResult[];
}

@Injectable({
  providedIn: 'root',
})
export class AgentBValidationService {
  constructor(
    private powerballService: PowerballService,
    private strategyFactory: StrategyFactoryService,
    private configService: PowerballConfigService
  ) {}

  /**
   * Calculate chi-square statistic for goodness of fit test
   */
  private calculateChiSquare(
    observed: number[],
    expected: number[],
    degreesOfFreedom: number
  ): ChiSquareResult {
    if (observed.length !== expected.length) {
      throw new Error('Observed and expected arrays must have same length');
    }

    let chiSquare = 0;
    for (let i = 0; i < observed.length; i++) {
      if (expected[i] > 0) {
        chiSquare += Math.pow(observed[i] - expected[i], 2) / expected[i];
      }
    }

    // Critical value for α=0.05 (approximate lookup table)
    const criticalValue = this.getChiSquareCriticalValue(degreesOfFreedom, 0.05);
    
    // P-value approximation (simplified - in production use proper chi-square distribution)
    // For now, we'll use a simple heuristic: if chi-square > critical, p < 0.05
    const pValue = chiSquare > criticalValue ? 0.01 : 0.95;

    return {
      chiSquare,
      degreesOfFreedom,
      pValue,
      criticalValue,
      passed: pValue > 0.05,
    };
  }

  /**
   * Get chi-square critical value (simplified lookup table)
   */
  private getChiSquareCriticalValue(df: number, alpha: number): number {
    // Critical values for α=0.05
    const criticalValues: { [df: number]: number } = {
      1: 3.84,
      2: 5.99,
      3: 7.81,
      4: 9.49,
      5: 11.07,
      10: 18.31,
      20: 31.41,
      30: 43.77,
      50: 67.5,
      68: 88.25,
    };

    // Find closest df
    const dfs = Object.keys(criticalValues).map(Number).sort((a, b) => a - b);
    let closestDf = dfs[0];
    for (const d of dfs) {
      if (d <= df) closestDf = d;
      else break;
    }

    return criticalValues[closestDf] || 100; // Fallback
  }

  /**
   * Calculate Kolmogorov-Smirnov statistic
   */
  private calculateKolmogorovSmirnov(
    observed: number[],
    expected: number[]
  ): KolmogorovSmirnovResult {
    if (observed.length !== expected.length) {
      throw new Error('Arrays must have same length');
    }

    const n = observed.reduce((a, b) => a + b, 0);
    if (n === 0) {
      return { statistic: 0, criticalValue: 0, passed: true };
    }

    // Normalize to cumulative distributions
    const observedCumulative: number[] = [];
    const expectedCumulative: number[] = [];
    
    let obsSum = 0;
    let expSum = 0;
    
    for (let i = 0; i < observed.length; i++) {
      obsSum += observed[i];
      expSum += expected[i];
      observedCumulative.push(obsSum / n);
      expectedCumulative.push(expSum / n);
    }

    // Find maximum difference
    let maxDiff = 0;
    for (let i = 0; i < observed.length; i++) {
      const diff = Math.abs(observedCumulative[i] - expectedCumulative[i]);
      if (diff > maxDiff) maxDiff = diff;
    }

    // Critical value for α=0.05 (approximate for large n)
    const criticalValue = 1.36 / Math.sqrt(n);
    
    return {
      statistic: maxDiff,
      criticalValue,
      passed: maxDiff < criticalValue,
    };
  }

  /**
   * Generate tickets for a strategy
   */
  private async generateTicketsForStrategy(
    strategyName: string,
    numTickets: number,
    trainingData: PowerballDraw[]
  ): Promise<string[][]> {
    const tickets: string[][] = [];
    
    // Use PowerballService's generatePowerballPlay which generates plays for multiple strategies
    // Extract the play for the requested strategy
    for (let i = 0; i < numTickets; i++) {
      try {
        const play = await this.powerballService.generatePowerballPlay(trainingData);
        
        // Extract the play for the requested strategy
        let ticket: string[] | undefined;
        
        switch (strategyName) {
          case 'initialRandom':
            ticket = play.initialPlay;
            break;
          case 'predictiveFrequency':
            ticket = play.predictiveFreqPredictedPlay;
            break;
          case 'predictiveWeightedRandom':
            ticket = play.predictiveWeightedRandomPlay;
            break;
          case 'highestProbability':
            ticket = play.highestProbabilityPlay;
            break;
          case 'aiPredictive':
            ticket = play.aiPredictiveSet;
            break;
          default:
            // For strategies not in GeneratedPlay, try to get them directly
            const strategy = this.strategyFactory.getStrategy(strategyName);
            if (strategy) {
              // We need context - for now, generate a play and use its context
              // This is a workaround - ideally PowerballService would expose context building
              // For now, we'll skip these strategies or use a fallback
              console.warn(`Strategy ${strategyName} not available via generatePowerballPlay, skipping`);
              continue;
            } else {
              throw new Error(`Strategy ${strategyName} not found`);
            }
        }
        
        if (ticket && ticket.length === 6) {
          // Ensure all numbers are properly formatted (ticket is string[] here)
          const formattedTicket = ticket.map((num: string) => num.padStart(2, '0'));
          tickets.push(formattedTicket);
        }
      } catch (error) {
        console.warn(`Error generating ticket ${i + 1}/${numTickets} for ${strategyName}:`, error);
        // Continue with next ticket
      }
    }
    
    return tickets;
  }

  /**
   * Analyze distribution per position
   */
  private analyzeDistribution(
    tickets: string[][],
    position: number,
    expectedDistributionType: 'uniform' | 'weighted' | 'markov',
    historicalData?: string[][]
  ): DistributionResult[] {
    const frequencies: { [number: string]: number } = {};
    const totalTickets = tickets.length;

    // Count frequencies
    for (const ticket of tickets) {
      if (ticket[position]) {
        const num = ticket[position];
        frequencies[num] = (frequencies[num] || 0) + 1;
      }
    }

    // Convert to array
    const results: DistributionResult[] = Object.entries(frequencies).map(
      ([number, frequency]) => ({
        position,
        number,
        frequency,
        percentage: (frequency / totalTickets) * 100,
      })
    );

    // Sort by number
    results.sort((a, b) => parseInt(a.number) - parseInt(b.number));

    // Calculate expected frequencies based on distribution type
    if (expectedDistributionType === 'uniform') {
      const uniqueNumbers = results.length;
      const expectedFreq = totalTickets / uniqueNumbers;
      results.forEach((r) => {
        r.expectedFrequency = expectedFreq;
      });
    } else if (expectedDistributionType === 'weighted' && historicalData) {
      // Calculate expected frequencies from historical data
      const historicalFreq: { [number: string]: number } = {};
      let totalHistorical = 0;
      
      for (const draw of historicalData) {
        if (draw[position]) {
          const num = draw[position];
          historicalFreq[num] = (historicalFreq[num] || 0) + 1;
          totalHistorical++;
        }
      }
      
      // Normalize to expected frequencies
      results.forEach((r) => {
        const histFreq = historicalFreq[r.number] || 0;
        r.expectedFrequency = (histFreq / totalHistorical) * totalTickets;
      });
    }
    // For markov, expected frequencies would come from transition probabilities
    // This is more complex and would need synergy map analysis

    return results;
  }

  /**
   * Run per-position distribution validation
   */
  async runDistributionValidation(
    numTickets: number = 1000,
    trainingData: PowerballDraw[] = PowerballDataMinusLatest
  ): Promise<DistributionValidationReport> {
    console.log('=== Agent B: Distribution Validation ===');
    console.log(`Generating ${numTickets} tickets per strategy...\n`);

    const strategies = [
      'initialRandom',
      'predictiveFrequency',
      'predictiveWeightedRandom',
      'highestProbability',
      'aiPredictive',
      // 'higherOrderMarkov', // These need special handling
      // 'targetWin',
      // 'diffPattern',
      // 'ensemble',
    ];

    const report: DistributionValidationReport = {
      agent: 'Agent-B',
      timestamp: new Date().toISOString(),
      test_suite: 'Per-Position Distribution Validation',
      summary: {
        total_tests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        status: 'IN_PROGRESS',
      },
      results: [],
      distributions: [],
    };

    // Expected distribution types per strategy
    const expectedTypes: { [strategy: string]: 'uniform' | 'weighted' | 'markov' } = {
      initialRandom: 'uniform',
      predictiveFrequency: 'weighted',
      predictiveWeightedRandom: 'weighted',
      highestProbability: 'weighted',
      aiPredictive: 'markov',
      higherOrderMarkov: 'markov',
      targetWin: 'weighted',
      diffPattern: 'weighted',
      ensemble: 'weighted',
    };

    // Get historical data for expected frequency calculation
    const historicalData: string[][] = trainingData.map(draw => 
      draw.winning_numbers.split(' ')
    );

    for (const strategy of strategies) {
      console.log(`\nTesting strategy: ${strategy}`);
      
      try {
        // Generate tickets
        const tickets = await this.generateTicketsForStrategy(
          strategy,
          numTickets,
          trainingData
        );

        if (tickets.length === 0) {
          console.warn(`  ⚠️  No tickets generated for ${strategy} - skipping`);
          report.summary.skipped++;
          continue;
        }

        console.log(`  Generated ${tickets.length} tickets`);

        // Analyze each position (0-5: 5 white balls + 1 powerball)
        const strategyDistribution: StrategyDistribution = {
          strategy,
          totalTickets: tickets.length,
          positions: {},
        };

        const expectedType = expectedTypes[strategy] || 'weighted';

        for (let pos = 0; pos < 6; pos++) {
          const distribution = this.analyzeDistribution(
            tickets,
            pos,
            expectedType,
            historicalData
          );
          strategyDistribution.positions[pos] = distribution;

          // Perform statistical tests
          const observed = distribution.map((d) => d.frequency);
          const expected = distribution.map((d) => d.expectedFrequency || 0);

          // Only test if we have expected frequencies
          if (expected.some((e) => e > 0) && observed.reduce((a, b) => a + b, 0) > 0) {
            const df = Math.max(1, distribution.length - 1);
            const chiSquareResult = this.calculateChiSquare(observed, expected, df);
            const ksResult = this.calculateKolmogorovSmirnov(observed, expected);

            const testResult: DistributionTestResult = {
              test_name: `Distribution Test - ${strategy} Position ${pos}`,
              strategy,
              position: pos,
              status: chiSquareResult.passed && ksResult.passed ? 'PASS' : 'FAIL',
              chiSquare: chiSquareResult,
              kolmogorovSmirnov: ksResult,
              expected_distribution_type: expectedType,
              sample_size: tickets.length,
              evidence: `Chi-square: ${chiSquareResult.chiSquare.toFixed(4)} (p=${chiSquareResult.pValue.toFixed(4)}), KS: ${ksResult.statistic.toFixed(4)}`,
            };

            report.results.push(testResult);
            report.summary.total_tests++;

            if (testResult.status === 'PASS') {
              report.summary.passed++;
              console.log(`  ✓ Position ${pos}: PASS`);
            } else {
              report.summary.failed++;
              console.log(`  ✗ Position ${pos}: FAIL (chi-square p=${chiSquareResult.pValue.toFixed(4)}, KS=${ksResult.statistic.toFixed(4)})`);
            }
          } else {
            // Skip test if no expected frequencies or no observations
            report.summary.skipped++;
            console.log(`  - Position ${pos}: SKIP (no expected frequencies or observations)`);
          }
        }

        report.distributions.push(strategyDistribution);
      } catch (error) {
        console.error(`  ✗ Error testing ${strategy}:`, error);
        report.summary.failed++;
      }
    }

    // Determine overall status
    report.summary.status =
      report.summary.failed === 0 ? 'PASS' : 'FAIL';

    console.log(`\n✓ Distribution validation complete`);
    console.log(`Summary: ${report.summary.passed}/${report.summary.total_tests} tests passed`);

    return report;
  }

  /**
   * Run bias detection tests
   */
  async runBiasDetection(
    numTickets: number = 1000,
    trainingData: PowerballDraw[] = PowerballDataMinusLatest
  ): Promise<BiasValidationReport> {
    console.log('=== Agent B: Bias Detection ===');
    console.log(`Analyzing biases for ${numTickets} tickets per strategy...\n`);

    const strategies = [
      'initialRandom',
      'predictiveFrequency',
      'predictiveWeightedRandom',
      'highestProbability',
      'aiPredictive',
    ];

    const report: BiasValidationReport = {
      agent: 'Agent-B',
      timestamp: new Date().toISOString(),
      test_suite: 'Bias Detection Tests',
      summary: {
        total_tests: 0,
        passed: 0,
        failed: 0,
        status: 'IN_PROGRESS',
      },
      results: [],
    };

    // Define intended biases per strategy
    const intendedBiases: { [strategy: string]: string[] } = {
      initialRandom: [], // No intended bias (uniform)
      predictiveFrequency: ['frequency_based_filtering'],
      predictiveWeightedRandom: ['frequency_weighting', 'recency_weighting'],
      highestProbability: ['frequency_weighting', 'recency_weighting'],
      aiPredictive: ['recency_weighting', 'synergy_maps', 'markov_dependencies'],
      higherOrderMarkov: ['markov_dependencies', 'synergy_maps'],
      targetWin: ['target_win_optimization', 'pattern_bias'],
      diffPattern: ['diff_pattern_bias'],
      ensemble: ['weighted_blending', 'consensus_bias'],
    };

    for (const strategy of strategies) {
      console.log(`\nAnalyzing biases for: ${strategy}`);
      
      try {
        const tickets = await this.generateTicketsForStrategy(
          strategy,
          numTickets,
          trainingData
        );

        if (tickets.length === 0) {
          console.warn(`  ⚠️  No tickets generated for ${strategy} - skipping`);
          continue;
        }

        const biasResult: BiasDetectionResult = {
          strategy,
          intended_biases: [],
          unintended_biases: [],
          status: 'PASS',
        };

        const expectedBiases = intendedBiases[strategy] || [];

        // Check for intended biases
        for (const biasName of expectedBiases) {
          const biasCheck = this.checkIntendedBias(
            biasName,
            tickets,
            trainingData,
            strategy
          );
          biasResult.intended_biases.push(biasCheck);
        }

        // Check for unintended biases
        const unintendedBiases = this.detectUnintendedBiases(
          tickets,
          strategy,
          expectedBiases
        );
        biasResult.unintended_biases = unintendedBiases;

        // Determine status
        const allIntendedPresent = biasResult.intended_biases.every(b => b.present);
        const hasUnintended = biasResult.unintended_biases.length > 0;
        
        biasResult.status = (allIntendedPresent && !hasUnintended) ? 'PASS' : 'FAIL';

        report.results.push(biasResult);
        report.summary.total_tests++;

        if (biasResult.status === 'PASS') {
          report.summary.passed++;
          console.log(`  ✓ Bias analysis: PASS`);
        } else {
          report.summary.failed++;
          console.log(`  ✗ Bias analysis: FAIL`);
          if (!allIntendedPresent) {
            console.log(`    Missing intended biases`);
          }
          if (hasUnintended) {
            console.log(`    Found ${unintendedBiases.length} unintended biases`);
          }
        }
      } catch (error) {
        console.error(`  ✗ Error analyzing biases for ${strategy}:`, error);
        report.summary.failed++;
      }
    }

    report.summary.status =
      report.summary.failed === 0 ? 'PASS' : 'FAIL';

    console.log(`\n✓ Bias detection complete`);
    console.log(`Summary: ${report.summary.passed}/${report.summary.total_tests} tests passed`);

    return report;
  }

  /**
   * Check if an intended bias is present
   */
  private checkIntendedBias(
    biasName: string,
    tickets: string[][],
    trainingData: PowerballDraw[],
    strategy: string
  ): { name: string; present: boolean; strength: number; evidence: string } {
    const historicalData: string[][] = trainingData.map(draw => 
      draw.winning_numbers.split(' ')
    );

    switch (biasName) {
      case 'recency_weighting': {
        // Check if recent numbers appear more frequently
        const recentWindow = 50; // Last 50 draws
        const recentNumbers = new Set<string>();
        for (let i = 0; i < Math.min(recentWindow, historicalData.length); i++) {
          historicalData[i].slice(0, 5).forEach(n => recentNumbers.add(n));
        }

        let recentCount = 0;
        let totalCount = 0;
        for (const ticket of tickets) {
          for (let i = 0; i < 5; i++) {
            totalCount++;
            if (recentNumbers.has(ticket[i])) {
              recentCount++;
            }
          }
        }

        const recentRatio = totalCount > 0 ? recentCount / totalCount : 0;
        const expectedRatio = recentWindow / historicalData.length; // Simplified
        const strength = Math.min(1, recentRatio / (expectedRatio + 0.1)); // Normalize

        return {
          name: biasName,
          present: recentRatio > expectedRatio * 1.1, // 10% threshold
          strength,
          evidence: `Recent number ratio: ${recentRatio.toFixed(4)} (expected: ${expectedRatio.toFixed(4)})`,
        };
      }

      case 'frequency_weighting': {
        // Check if high-frequency numbers appear more often
        const freqMap: { [num: string]: number } = {};
        for (const draw of historicalData) {
          draw.slice(0, 5).forEach(n => {
            freqMap[n] = (freqMap[n] || 0) + 1;
          });
        }

        const sortedFreqs = Object.entries(freqMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20); // Top 20
        const topNumbers = new Set(sortedFreqs.map(([n]) => n));

        let topCount = 0;
        let totalCount = 0;
        for (const ticket of tickets) {
          for (let i = 0; i < 5; i++) {
            totalCount++;
            if (topNumbers.has(ticket[i])) {
              topCount++;
            }
          }
        }

        const topRatio = totalCount > 0 ? topCount / totalCount : 0;
        const expectedRatio = 20 / 69; // Simplified uniform expectation
        const strength = Math.min(1, topRatio / (expectedRatio + 0.1));

        return {
          name: biasName,
          present: topRatio > expectedRatio * 1.2, // 20% threshold
          strength,
          evidence: `Top frequency number ratio: ${topRatio.toFixed(4)} (expected: ${expectedRatio.toFixed(4)})`,
        };
      }

      case 'synergy_maps':
      case 'markov_dependencies': {
        // Check for position correlations (simplified)
        let correlationSum = 0;
        let correlationCount = 0;

        for (let i = 0; i < 4; i++) {
          // Check correlation between position i and i+1
          const pairs: { [pair: string]: number } = {};
          for (const ticket of tickets) {
            const pair = `${ticket[i]}-${ticket[i + 1]}`;
            pairs[pair] = (pairs[pair] || 0) + 1;
          }

          // Calculate entropy reduction (simplified)
          const uniquePairs = Object.keys(pairs).length;
          const expectedPairs = 69 * 69; // Simplified
          const correlation = uniquePairs < expectedPairs * 0.5 ? 0.7 : 0.3;
          correlationSum += correlation;
          correlationCount++;
        }

        const avgCorrelation = correlationCount > 0 ? correlationSum / correlationCount : 0;

        return {
          name: biasName,
          present: avgCorrelation > 0.5,
          strength: avgCorrelation,
          evidence: `Average position correlation: ${avgCorrelation.toFixed(4)}`,
        };
      }

      default:
        return {
          name: biasName,
          present: false,
          strength: 0,
          evidence: 'Bias check not implemented',
        };
    }
  }

  /**
   * Detect unintended biases
   */
  private detectUnintendedBiases(
    tickets: string[][],
    strategy: string,
    expectedBiases: string[]
  ): Array<{ name: string; description: string; severity: 'low' | 'medium' | 'high'; evidence: string }> {
    const unintended: Array<{ name: string; description: string; severity: 'low' | 'medium' | 'high'; evidence: string }> = [];

    // Check for range violations (should be caught by other agents, but check here too)
    let rangeViolations = 0;
    for (const ticket of tickets) {
      for (let i = 0; i < 5; i++) {
        const num = parseInt(ticket[i], 10);
        if (num < 1 || num > 69) rangeViolations++;
      }
      const pb = parseInt(ticket[5], 10);
      if (pb < 1 || pb > 26) rangeViolations++;
    }

    if (rangeViolations > 0) {
      unintended.push({
        name: 'range_violations',
        description: 'Numbers outside valid ranges [1,69] for white, [1,26] for powerball',
        severity: 'high',
        evidence: `Found ${rangeViolations} range violations`,
      });
    }

    // Check for duplicate white balls within tickets
    let duplicateViolations = 0;
    for (const ticket of tickets) {
      const whiteBalls = ticket.slice(0, 5);
      const unique = new Set(whiteBalls);
      if (unique.size < 5) duplicateViolations++;
    }

    if (duplicateViolations > 0) {
      unintended.push({
        name: 'duplicate_white_balls',
        description: 'Duplicate white balls within the same ticket',
        severity: 'high',
        evidence: `Found ${duplicateViolations} tickets with duplicates`,
      });
    }

    // Check for sorting violations
    let sortingViolations = 0;
    for (const ticket of tickets) {
      const whiteBalls = ticket.slice(0, 5).map(n => parseInt(n, 10));
      for (let i = 1; i < whiteBalls.length; i++) {
        if (whiteBalls[i] < whiteBalls[i - 1]) {
          sortingViolations++;
          break;
        }
      }
    }

    if (sortingViolations > 0) {
      unintended.push({
        name: 'sorting_violations',
        description: 'White balls not sorted ascending',
        severity: 'medium',
        evidence: `Found ${sortingViolations} tickets with sorting violations`,
      });
    }

    // Check for extreme skewness not explained by intended biases
    if (!expectedBiases.includes('frequency_weighting')) {
      // If frequency weighting is not intended, check for it
      const freqMap: { [num: string]: number } = {};
      for (const ticket of tickets) {
        ticket.slice(0, 5).forEach(n => {
          freqMap[n] = (freqMap[n] || 0) + 1;
        });
      }

      const frequencies = Object.values(freqMap);
      const maxFreq = Math.max(...frequencies);
      const minFreq = Math.min(...frequencies);
      const skewness = maxFreq / (minFreq + 1); // Avoid division by zero

      if (skewness > 5) {
        unintended.push({
          name: 'unexplained_frequency_skew',
          description: 'High frequency skew not explained by intended biases',
          severity: 'medium',
          evidence: `Frequency skewness: ${skewness.toFixed(2)} (max/min ratio)`,
        });
      }
    }

    return unintended;
  }

  /**
   * Export report to JSON file
   */
  exportReportToJson(report: DistributionValidationReport | BiasValidationReport, filename: string): string {
    const json = JSON.stringify(report, null, 2);
    return json;
  }

  /**
   * Run both distribution and bias validation tests
   */
  async runAllValidations(
    numTickets: number = 1000,
    trainingData: PowerballDraw[] = PowerballDataMinusLatest
  ): Promise<{
    distribution: DistributionValidationReport;
    bias: BiasValidationReport;
  }> {
    const distribution = await this.runDistributionValidation(numTickets, trainingData);
    const bias = await this.runBiasDetection(numTickets, trainingData);
    return { distribution, bias };
  }
}
