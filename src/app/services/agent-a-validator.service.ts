import { Injectable } from '@angular/core';
import { PowerballService } from './powerball.service';
import { StrategyFactoryService } from './strategies/strategy-factory.service';
import { GenerationContext } from './strategies/generation-strategy.interface';
import { PowerballDataMinusLatest } from '../data/historical-data';
import { PowerballDraw } from '../models/powerball-draw.interface';

/**
 * Agent A: Randomness & Entropy Validator
 * 
 * Validates entropy, uniformity, RNG behavior, and coupling effects.
 * Does NOT modify strategy code - only reports findings.
 */
@Injectable({
  providedIn: 'root',
})
export class AgentAValidatorService {
  private readonly STRATEGY_NAMES = [
    'initialRandom',
    'predictiveFrequency',
    'predictiveWeightedRandom',
    'highestProbability',
    'aiPredictive',
    'higherOrderMarkov',
    'targetWin',
    'diffPattern',
    'ensemble'
  ];

  constructor(
    private powerballService: PowerballService,
    private strategyFactory: StrategyFactoryService
  ) {}

  /**
   * Runs all Agent A tests and generates reports
   */
  async runAllTests(): Promise<void> {
    console.log('Agent A: Starting validation tests...');
    
    // Build context once for all tests
    const context = await this.buildTestContext();
    
    // Run tests
    const entropyResults = await this.runEntropyEstimationTests(context);
    const uniformityResults = await this.runUniformityTests(context);
    const couplingResults = await this.runCouplingDetectionTests(context);
    
    // Generate reports
    this.generateEntropyReport(entropyResults);
    this.generateUniformityReport(uniformityResults);
    this.generateCouplingReport(couplingResults);
    
    console.log('Agent A: All tests completed');
  }

  /**
   * Test 1: Entropy Estimation
   * Generates N≥2000 tickets per strategy and estimates entropy per position
   */
  async runEntropyEstimationTests(context: GenerationContext): Promise<EntropyTestResults> {
    console.log('Running entropy estimation tests (N≥2000 per strategy)...');
    const N = 2000;
    const results: EntropyTestResults = {
      timestamp: new Date().toISOString(),
      sampleSize: N,
      strategies: {}
    };

    for (const strategyName of this.STRATEGY_NAMES) {
      const strategy = this.strategyFactory.getStrategy(strategyName);
      if (!strategy) {
        console.warn(`Strategy ${strategyName} not found, skipping`);
        continue;
      }

      console.log(`  Testing strategy: ${strategyName}`);
      const tickets = await this.generateTickets(strategy, context, N);
      
      // Calculate entropy per position
      const entropyPerPosition: number[] = [];
      const maxEntropy: number[] = [];
      
      for (let pos = 0; pos < 6; pos++) {
        const positionValues = tickets.map(t => parseInt(t[pos], 10));
        const entropy = this.calculateEntropy(positionValues);
        const maxH = pos === 5 ? Math.log2(26) : Math.log2(69);
        
        entropyPerPosition.push(entropy);
        maxEntropy.push(maxH);
      }

      results.strategies[strategyName] = {
        entropyPerPosition,
        maxEntropy,
        expectedEntropy: this.getExpectedEntropy(strategyName, context),
        difference: entropyPerPosition.map((h, i) => h - (results.strategies[strategyName]?.expectedEntropy?.[i] || maxEntropy[i]))
      };
    }

    return results;
  }

  /**
   * Test 2: Uniformity Test (Initial Random Strategy only)
   * Generates N≥1000 tickets and performs chi-square test
   */
  async runUniformityTests(context: GenerationContext): Promise<UniformityTestResults> {
    console.log('Running uniformity tests for Initial Random strategy (N≥1000)...');
    const N = 1000;
    const strategyName = 'initialRandom';
    const strategy = this.strategyFactory.getStrategy(strategyName);
    
    if (!strategy) {
      throw new Error(`Strategy ${strategyName} not found`);
    }

    const tickets = await this.generateTickets(strategy, context, N);
    const results: UniformityTestResults = {
      timestamp: new Date().toISOString(),
      sampleSize: N,
      strategy: strategyName,
      positions: {}
    };

    // Get filtered sets for expected uniform distribution
    const filteredSets = context.filteredParsedSets;
    
    for (let pos = 0; pos < 6; pos++) {
      const positionValues = tickets.map(t => parseInt(t[pos], 10));
      const filteredSet = filteredSets.find(s => 
        (pos === 5 && s.key === 'powerball') ||
        (pos === 0 && s.key === 'first') ||
        (pos === 1 && s.key === 'second') ||
        (pos === 2 && s.key === 'third') ||
        (pos === 3 && s.key === 'fourth') ||
        (pos === 4 && s.key === 'fifth')
      );

      if (!filteredSet) {
        console.warn(`No filtered set found for position ${pos}`);
        continue;
      }

      const expectedFreq = N / filteredSet.numbers.length;
      const observedFreq = this.calculateFrequencyDistribution(positionValues);
      
      // Chi-square test
      const chiSquare = this.calculateChiSquare(
        filteredSet.numbers,
        observedFreq,
        expectedFreq
      );
      
      const degreesOfFreedom = filteredSet.numbers.length - 1;
      const pValue = this.chiSquarePValue(chiSquare, degreesOfFreedom);
      const criticalValue = this.chiSquareCriticalValue(degreesOfFreedom, 0.05);

      results.positions[pos] = {
        filteredSetSize: filteredSet.numbers.length,
        chiSquare,
        degreesOfFreedom,
        pValue,
        criticalValue,
        passed: pValue > 0.05 && chiSquare < criticalValue,
        observedDistribution: observedFreq,
        expectedFrequency: expectedFreq
      };
    }

    return results;
  }

  /**
   * Test 3: Coupling Detection
   * Generates N≥2000 tickets from multiple strategies and tests for correlation
   */
  async runCouplingDetectionTests(context: GenerationContext): Promise<CouplingTestResults> {
    console.log('Running coupling detection tests (N≥2000 per strategy pair)...');
    const N = 2000;
    const results: CouplingTestResults = {
      timestamp: new Date().toISOString(),
      sampleSize: N,
      strategyPairs: {}
    };

    const strategyPairs: Array<[string, string]> = [];
    for (let i = 0; i < this.STRATEGY_NAMES.length; i++) {
      for (let j = i + 1; j < this.STRATEGY_NAMES.length; j++) {
        strategyPairs.push([this.STRATEGY_NAMES[i], this.STRATEGY_NAMES[j]]);
      }
    }

    // Generate tickets for all strategies first
    const strategyTickets: Record<string, string[][]> = {};
    for (const strategyName of this.STRATEGY_NAMES) {
      const strategy = this.strategyFactory.getStrategy(strategyName);
      if (strategy) {
        strategyTickets[strategyName] = await this.generateTickets(strategy, context, N);
      }
    }

    // Test each pair
    for (const [strategy1, strategy2] of strategyPairs) {
      const tickets1 = strategyTickets[strategy1];
      const tickets2 = strategyTickets[strategy2];
      
      if (!tickets1 || !tickets2) continue;

      const correlations: number[] = [];
      const mutualInfo: number[] = [];
      
      // Test correlation per position
      for (let pos = 0; pos < 6; pos++) {
        const values1 = tickets1.map(t => parseInt(t[pos], 10));
        const values2 = tickets2.map(t => parseInt(t[pos], 10));
        
        const correlation = this.calculatePearsonCorrelation(values1, values2);
        const mi = this.calculateMutualInformation(values1, values2);
        
        correlations.push(correlation);
        mutualInfo.push(mi);
      }

      const maxCorrelation = Math.max(...correlations.map(Math.abs));
      const maxMutualInfo = Math.max(...mutualInfo);

      results.strategyPairs[`${strategy1}_vs_${strategy2}`] = {
        correlations,
        mutualInformation: mutualInfo,
        maxCorrelation,
        maxMutualInfo,
        passed: maxCorrelation < 0.2 && maxMutualInfo < 0.05,
        independenceTest: this.testIndependence(tickets1, tickets2)
      };
    }

    return results;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async buildTestContext(): Promise<GenerationContext> {
    // Use PowerballService to build context properly
    return await this.powerballService.buildGenerationContextForTesting(PowerballDataMinusLatest);
  }

  private async generateTickets(
    strategy: any,
    context: GenerationContext,
    count: number
  ): Promise<string[][]> {
    const tickets: string[][] = [];
    for (let i = 0; i < count; i++) {
      try {
        const ticket = await strategy.generate(context);
        if (ticket && ticket.length === 6) {
          tickets.push(ticket);
        }
      } catch (error) {
        console.warn(`Error generating ticket ${i}:`, error);
      }
    }
    return tickets;
  }

  private calculateEntropy(values: number[]): number {
    const freq = this.calculateFrequencyDistribution(values);
    const total = values.length;
    let entropy = 0;
    
    for (const count of Object.values(freq)) {
      if (count > 0) {
        const p = count / total;
        entropy -= p * Math.log2(p);
      }
    }
    
    return entropy;
  }

  private calculateFrequencyDistribution(values: number[]): Record<number, number> {
    const freq: Record<number, number> = {};
    for (const value of values) {
      freq[value] = (freq[value] || 0) + 1;
    }
    return freq;
  }

  private getExpectedEntropy(strategyName: string, context: GenerationContext): number[] {
    const filteredSets = context.filteredParsedSets;
    const expected: number[] = [];
    
    for (let pos = 0; pos < 6; pos++) {
      const filteredSet = filteredSets.find(s => 
        (pos === 5 && s.key === 'powerball') ||
        (pos === 0 && s.key === 'first') ||
        (pos === 1 && s.key === 'second') ||
        (pos === 2 && s.key === 'third') ||
        (pos === 3 && s.key === 'fourth') ||
        (pos === 4 && s.key === 'fifth')
      );
      
      if (strategyName === 'initialRandom' && filteredSet) {
        // Uniform over filtered set
        expected.push(Math.log2(filteredSet.numbers.length));
      } else {
        // Weighted/Markov strategies have lower entropy
        const maxH = pos === 5 ? Math.log2(26) : Math.log2(69);
        expected.push(maxH * 0.7); // Rough estimate - actual depends on weighting
      }
    }
    
    return expected;
  }

  private calculateChiSquare(
    categories: number[],
    observedFreq: Record<number, number>,
    expectedFreq: number
  ): number {
    let chiSquare = 0;
    for (const category of categories) {
      const observed = observedFreq[category] || 0;
      chiSquare += Math.pow(observed - expectedFreq, 2) / expectedFreq;
    }
    return chiSquare;
  }

  private chiSquarePValue(chiSquare: number, df: number): number {
    // Simplified chi-square p-value approximation
    // For production, use proper chi-square distribution
    if (df <= 0) return 1;
    
    // Approximation using incomplete gamma function
    // This is a simplified version - for accurate results, use a proper statistical library
    const x = chiSquare / 2;
    let sum = 1;
    let term = 1;
    
    for (let i = 1; i < df / 2; i++) {
      term *= x / i;
      sum += term;
    }
    
    const pValue = 1 - Math.exp(-x) * sum;
    return Math.max(0, Math.min(1, pValue));
  }

  private chiSquareCriticalValue(df: number, alpha: number): number {
    // Simplified critical values for common df and alpha=0.05
    // For production, use proper chi-square distribution table
    const criticalValues: Record<number, number> = {
      1: 3.84,
      2: 5.99,
      3: 7.81,
      4: 9.49,
      5: 11.07,
      10: 18.31,
      20: 31.41,
      30: 43.77,
      50: 67.50,
      69: 90.53,
    };
    
    if (criticalValues[df]) return criticalValues[df];
    
    // Approximation for large df
    return df + Math.sqrt(2 * df) * 1.96;
  }

  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length) return 0;
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    if (denominator === 0) return 0;
    return numerator / denominator;
  }

  private calculateMutualInformation(x: number[], y: number[]): number {
    const freqX = this.calculateFrequencyDistribution(x);
    const freqY = this.calculateFrequencyDistribution(y);
    const freqXY: Record<string, number> = {};
    
    for (let i = 0; i < x.length; i++) {
      const key = `${x[i]},${y[i]}`;
      freqXY[key] = (freqXY[key] || 0) + 1;
    }
    
    const n = x.length;
    let mi = 0;
    
    for (const [key, countXY] of Object.entries(freqXY)) {
      const [xVal, yVal] = key.split(',').map(Number);
      const countX = freqX[xVal] || 0;
      const countY = freqY[yVal] || 0;
      
      if (countXY > 0 && countX > 0 && countY > 0) {
        const pXY = countXY / n;
        const pX = countX / n;
        const pY = countY / n;
        mi += pXY * Math.log2(pXY / (pX * pY));
      }
    }
    
    return Math.max(0, mi);
  }

  private testIndependence(tickets1: string[][], tickets2: string[][]): IndependenceTestResult {
    // Chi-square test for independence
    const n = Math.min(tickets1.length, tickets2.length);
    const contingency: Record<string, number> = {};
    
    for (let i = 0; i < n; i++) {
      const key = `${tickets1[i].join(',')}_vs_${tickets2[i].join(',')}`;
      contingency[key] = (contingency[key] || 0) + 1;
    }
    
    // Simplified independence test
    const expected = n / Object.keys(contingency).length;
    let chiSquare = 0;
    
    for (const count of Object.values(contingency)) {
      chiSquare += Math.pow(count - expected, 2) / expected;
    }
    
    const df = Object.keys(contingency).length - 1;
    const pValue = this.chiSquarePValue(chiSquare, df);
    
    return {
      chiSquare,
      degreesOfFreedom: df,
      pValue,
      passed: pValue > 0.05
    };
  }

  // ============================================================================
  // Report Generation
  // ============================================================================

  private generateEntropyReport(results: EntropyTestResults): void {
    const report = {
      agent: 'Agent-A',
      timestamp: results.timestamp,
      test_suite: 'Entropy Estimation',
      summary: {
        total_tests: Object.keys(results.strategies).length,
        passed: 0,
        failed: 0,
        status: 'PENDING'
      },
      results: [] as any[]
    };

    for (const [strategyName, data] of Object.entries(results.strategies)) {
      const maxDiff = Math.max(...data.difference.map(Math.abs));
      const passed = maxDiff <= 0.5; // Tolerance: ±0.5 bits
      
      if (passed) report.summary.passed++;
      else report.summary.failed++;

      report.results.push({
        test_name: `Entropy Test - ${strategyName}`,
        status: passed ? 'PASS' : 'FAIL',
        strategy: strategyName,
        entropy_per_position: data.entropyPerPosition,
        expected_entropy: data.expectedEntropy,
        max_entropy: data.maxEntropy,
        difference: data.difference,
        max_difference: maxDiff,
        tolerance: 0.5,
        sample_size: results.sampleSize
      });
    }

    report.summary.status = report.summary.failed === 0 ? 'PASS' : 'FAIL';
    
    console.log('\n=== ENTROPY REPORT ===');
    console.log(JSON.stringify(report, null, 2));
    
    // Save as downloadable file
    this.downloadJSON(report, 'agent-a-entropy-report.json');
  }

  private generateUniformityReport(results: UniformityTestResults): void {
    const report = {
      agent: 'Agent-A',
      timestamp: results.timestamp,
      test_suite: 'Uniformity Test (Initial Random)',
      summary: {
        total_tests: Object.keys(results.positions).length,
        passed: 0,
        failed: 0,
        status: 'PENDING'
      },
      results: [] as any[]
    };

    for (const [pos, data] of Object.entries(results.positions)) {
      if (data.passed) report.summary.passed++;
      else report.summary.failed++;

      report.results.push({
        test_name: `Uniformity Test - Position ${pos}`,
        status: data.passed ? 'PASS' : 'FAIL',
        position: parseInt(pos),
        chi_square: data.chiSquare,
        degrees_of_freedom: data.degreesOfFreedom,
        p_value: data.pValue,
        critical_value: data.criticalValue,
        filtered_set_size: data.filteredSetSize,
        expected_frequency: data.expectedFrequency,
        sample_size: results.sampleSize
      });
    }

    report.summary.status = report.summary.failed === 0 ? 'PASS' : 'FAIL';
    
    console.log('\n=== UNIFORMITY REPORT ===');
    console.log(JSON.stringify(report, null, 2));
    
    // Save as downloadable file
    this.downloadJSON(report, 'agent-a-uniformity-report.json');
  }

  private generateCouplingReport(results: CouplingTestResults): void {
    const report = {
      agent: 'Agent-A',
      timestamp: results.timestamp,
      test_suite: 'Coupling Detection',
      summary: {
        total_tests: Object.keys(results.strategyPairs).length,
        passed: 0,
        failed: 0,
        status: 'PENDING'
      },
      results: [] as any[]
    };

    for (const [pairName, data] of Object.entries(results.strategyPairs)) {
      if (data.passed) report.summary.passed++;
      else report.summary.failed++;

      report.results.push({
        test_name: `Coupling Test - ${pairName}`,
        status: data.passed ? 'PASS' : 'FAIL',
        strategy_pair: pairName,
        max_correlation: data.maxCorrelation,
        max_mutual_information: data.maxMutualInfo,
        correlations_per_position: data.correlations,
        mutual_information_per_position: data.mutualInformation,
        independence_test: data.independenceTest,
        sample_size: results.sampleSize
      });
    }

    report.summary.status = report.summary.failed === 0 ? 'PASS' : 'FAIL';
    
    console.log('\n=== COUPLING REPORT ===');
    console.log(JSON.stringify(report, null, 2));
    
    // Save as downloadable file
    this.downloadJSON(report, 'agent-a-coupling-report.json');
  }

  /**
   * Downloads JSON data as a file (browser environment)
   */
  private downloadJSON(data: any, filename: string): void {
    try {
      if (typeof document === 'undefined') {
        // Non-browser environment - just log
        console.log(`\n${filename}:`, JSON.stringify(data, null, 2));
        return;
      }
      
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn(`Could not download ${filename}:`, error);
      // Fallback: just log the JSON
      console.log(`\n${filename}:`, JSON.stringify(data, null, 2));
    }
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

interface EntropyTestResults {
  timestamp: string;
  sampleSize: number;
  strategies: Record<string, {
    entropyPerPosition: number[];
    maxEntropy: number[];
    expectedEntropy: number[];
    difference: number[];
  }>;
}

interface UniformityTestResults {
  timestamp: string;
  sampleSize: number;
  strategy: string;
  positions: Record<number, {
    filteredSetSize: number;
    chiSquare: number;
    degreesOfFreedom: number;
    pValue: number;
    criticalValue: number;
    passed: boolean;
    observedDistribution: Record<number, number>;
    expectedFrequency: number;
  }>;
}

interface CouplingTestResults {
  timestamp: string;
  sampleSize: number;
  strategyPairs: Record<string, {
    correlations: number[];
    mutualInformation: number[];
    maxCorrelation: number;
    maxMutualInfo: number;
    passed: boolean;
    independenceTest: IndependenceTestResult;
  }>;
}

interface IndependenceTestResult {
  chiSquare: number;
  degreesOfFreedom: number;
  pValue: number;
  passed: boolean;
}
