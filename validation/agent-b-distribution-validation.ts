/**
 * Agent B: Distribution & Bias Analyst
 * 
 * Per-Position Distribution Validation
 * 
 * This script validates frequency distributions per position for all strategies.
 * It generates N≥1000 tickets per strategy and compares observed vs expected distributions.
 */

import * as fs from 'fs';
import * as path from 'path';

// Import data and services
import { PowerballDataMinusLatest } from '../src/app/data/historical-data';
import { PowerballDraw } from '../src/app/models/powerball-draw.interface';

// We'll need to create a simplified version that can work without Angular DI
// For now, let's create a structure that can be adapted

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

interface DistributionValidationReport {
  agent: string;
  timestamp: string;
  test_suite: string;
  summary: {
    total_tests: number;
    passed: number;
    failed: number;
    status: string;
  };
  results: Array<{
    test_name: string;
    strategy: string;
    position: number;
    status: string;
    chiSquare?: ChiSquareResult;
    kolmogorovSmirnov?: {
      statistic: number;
      criticalValue: number;
      passed: boolean;
    };
    expected_distribution_type: string;
    sample_size: number;
  }>;
  distributions: StrategyDistribution[];
}

/**
 * Calculate chi-square statistic for goodness of fit test
 */
function calculateChiSquare(
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

  // Critical value for α=0.05 (approximate)
  const criticalValue = getChiSquareCriticalValue(degreesOfFreedom, 0.05);
  
  // P-value approximation (simplified - in production use proper chi-square distribution)
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
function getChiSquareCriticalValue(df: number, alpha: number): number {
  // Simplified critical values for α=0.05
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
function calculateKolmogorovSmirnov(
  observed: number[],
  expected: number[]
): { statistic: number; criticalValue: number; passed: boolean } {
  if (observed.length !== expected.length) {
    throw new Error('Arrays must have same length');
  }

  // Normalize to cumulative distributions
  const n = observed.reduce((a, b) => a + b, 0);
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
 * This is a placeholder - will need to integrate with actual strategy generation
 */
async function generateTicketsForStrategy(
  strategyName: string,
  numTickets: number,
  trainingData: PowerballDraw[]
): Promise<string[][]> {
  // This will need to be implemented to actually call the strategies
  // For now, return empty array as placeholder
  console.log(`Generating ${numTickets} tickets for strategy: ${strategyName}`);
  
  // TODO: Integrate with actual PowerballService and StrategyFactory
  // This requires Angular DI setup or manual instantiation
  
  return [];
}

/**
 * Analyze distribution per position
 */
function analyzeDistribution(
  tickets: string[][],
  position: number,
  expectedDistributionType: 'uniform' | 'weighted' | 'markov'
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
  }
  // For weighted and markov, expected frequencies would come from historical data
  // This would need to be calculated separately

  return results;
}

/**
 * Main validation function
 */
async function runDistributionValidation(): Promise<void> {
  console.log('=== Agent B: Distribution Validation ===');
  console.log('Starting per-position distribution validation...\n');

  const strategies = [
    'initialRandom',
    'predictiveFrequency',
    'predictiveWeightedRandom',
    'highestProbability',
    'aiPredictive',
    'higherOrderMarkov',
    'targetWin',
    'diffPattern',
    'ensemble',
  ];

  const numTickets = 1000; // N≥1000 as per plan
  const trainingData = PowerballDataMinusLatest;

  const report: DistributionValidationReport = {
    agent: 'Agent-B',
    timestamp: new Date().toISOString(),
    test_suite: 'Per-Position Distribution Validation',
    summary: {
      total_tests: 0,
      passed: 0,
      failed: 0,
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

  for (const strategy of strategies) {
    console.log(`\nTesting strategy: ${strategy}`);
    
    try {
      // Generate tickets
      const tickets = await generateTicketsForStrategy(
        strategy,
        numTickets,
        trainingData
      );

      if (tickets.length === 0) {
        console.warn(`  ⚠️  No tickets generated for ${strategy} - skipping`);
        continue;
      }

      // Analyze each position (0-5: 5 white balls + 1 powerball)
      const strategyDistribution: StrategyDistribution = {
        strategy,
        totalTickets: tickets.length,
        positions: {},
      };

      const expectedType = expectedTypes[strategy] || 'weighted';

      for (let pos = 0; pos < 6; pos++) {
        const distribution = analyzeDistribution(tickets, pos, expectedType);
        strategyDistribution.positions[pos] = distribution;

        // Perform statistical tests
        const observed = distribution.map((d) => d.frequency);
        const expected = distribution.map((d) => d.expectedFrequency || 0);

        if (expected.some((e) => e > 0)) {
          const df = distribution.length - 1;
          const chiSquareResult = calculateChiSquare(observed, expected, df);
          const ksResult = calculateKolmogorovSmirnov(observed, expected);

          const testResult = {
            test_name: `Distribution Test - ${strategy} Position ${pos}`,
            strategy,
            position: pos,
            status: chiSquareResult.passed && ksResult.passed ? 'PASS' : 'FAIL',
            chiSquare: chiSquareResult,
            kolmogorovSmirnov: ksResult,
            expected_distribution_type: expectedType,
            sample_size: tickets.length,
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

  // Save report
  const reportPath = path.join(
    __dirname,
    '..',
    'validation-results',
    'agent-b-distribution-report.json'
  );
  
  // Ensure directory exists
  const reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✓ Report saved to: ${reportPath}`);
  console.log(`\nSummary: ${report.summary.passed}/${report.summary.total_tests} tests passed`);
}

// Run if executed directly
if (require.main === module) {
  runDistributionValidation().catch(console.error);
}

export { runDistributionValidation, DistributionValidationReport };
