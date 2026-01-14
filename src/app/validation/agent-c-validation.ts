/**
 * Agent C Validation Script
 * 
 * Validates:
 * 1. Diff calculation correctness (manual vs computed, N≥100 picks)
 * 2. Percentage calculations and sums (must be ≤100% per position)
 */

import { DiffAnalysisService } from '../services/diff-analysis.service';
import { PowerballData } from '../data/powerball-data';
import { allLatestPicks } from '../data/test-latest';
import { BallDiff, PickDiffAnalysis, DiffPatternAnalysis } from '../models/powerball-draw.interface';

interface ValidationResult {
  testName: string;
  status: 'PASS' | 'FAIL';
  details: any;
  errors?: string[];
}

interface DiffCalculationReport {
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
    status: string;
    metric: any;
    expected: any;
    tolerance: any;
    evidence: any;
    sample_size: number;
  }>;
  artifacts: string[];
}

/**
 * Manually calculates diff for a single pick against latest draw
 */
function manualDiffCalculation(pick: string[], latestDraw: string[]): BallDiff[] {
  const ballDiffs: BallDiff[] = [];

  for (let i = 0; i < 6; i++) {
    const pickValue = pick[i];
    const drawValue = latestDraw[i];

    const pickNum = parseInt(pickValue, 10);
    const drawNum = parseInt(drawValue, 10);

    if (isNaN(pickNum) || isNaN(drawNum)) {
      continue;
    }

    const diff = pickNum - drawNum;
    const diffString = diff > 0 ? `+${diff}` : diff.toString();

    ballDiffs.push({
      position: i,
      pickValue,
      drawValue,
      diff,
      diffString,
    });
  }

  return ballDiffs;
}

/**
 * Test 1: Verify diff calculation correctness
 */
function testDiffCalculation(
  picks: string[][],
  latestDraw: string[],
  service: DiffAnalysisService
): ValidationResult {
  const errors: string[] = [];
  let matchCount = 0;
  let totalComparisons = 0;

  // Compute diffs using service
  const serviceAnalyses = service.analyzePicks(picks, latestDraw);

  // Compare each pick's diffs manually vs service
  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i];
    const serviceAnalysis = serviceAnalyses[i];

    if (!pick || pick.length !== 6) {
      continue;
    }

    // Manual calculation
    const manualDiffs = manualDiffCalculation(pick, latestDraw);
    const serviceDiffs = serviceAnalysis.ballDiffs;

    // Compare diffs
    if (manualDiffs.length !== serviceDiffs.length) {
      errors.push(
        `Pick ${i}: Manual diffs count (${manualDiffs.length}) != Service diffs count (${serviceDiffs.length})`
      );
      continue;
    }

    // Compare each position
    for (let pos = 0; pos < manualDiffs.length; pos++) {
      totalComparisons++;
      const manualDiff = manualDiffs[pos];
      const serviceDiff = serviceDiffs[pos];

      if (!serviceDiff) {
        errors.push(`Pick ${i}, Position ${pos}: Service diff missing`);
        continue;
      }

      // Compare all fields
      if (manualDiff.position !== serviceDiff.position) {
        errors.push(
          `Pick ${i}, Position ${pos}: Position mismatch - Manual: ${manualDiff.position}, Service: ${serviceDiff.position}`
        );
      }
      if (manualDiff.pickValue !== serviceDiff.pickValue) {
        errors.push(
          `Pick ${i}, Position ${pos}: PickValue mismatch - Manual: ${manualDiff.pickValue}, Service: ${serviceDiff.pickValue}`
        );
      }
      if (manualDiff.drawValue !== serviceDiff.drawValue) {
        errors.push(
          `Pick ${i}, Position ${pos}: DrawValue mismatch - Manual: ${manualDiff.drawValue}, Service: ${serviceDiff.drawValue}`
        );
      }
      if (manualDiff.diff !== serviceDiff.diff) {
        errors.push(
          `Pick ${i}, Position ${pos}: Diff mismatch - Manual: ${manualDiff.diff}, Service: ${serviceDiff.diff}`
        );
      }
      if (manualDiff.diffString !== serviceDiff.diffString) {
        errors.push(
          `Pick ${i}, Position ${pos}: DiffString mismatch - Manual: ${manualDiff.diffString}, Service: ${serviceDiff.diffString}`
        );
      }

      // If all match, increment match count
      if (
        manualDiff.position === serviceDiff.position &&
        manualDiff.pickValue === serviceDiff.pickValue &&
        manualDiff.drawValue === serviceDiff.drawValue &&
        manualDiff.diff === serviceDiff.diff &&
        manualDiff.diffString === serviceDiff.diffString
      ) {
        matchCount++;
      }
    }
  }

  const accuracy = totalComparisons > 0 ? (matchCount / totalComparisons) * 100 : 0;
  const status = errors.length === 0 && accuracy === 100 ? 'PASS' : 'FAIL';

  return {
    testName: 'Diff Calculation Verification',
    status,
    details: {
      totalPicks: picks.length,
      totalComparisons,
      matchCount,
      accuracy: `${accuracy.toFixed(2)}%`,
      errors: errors.length,
      errorDetails: errors.slice(0, 10), // First 10 errors
    },
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Test 2: Verify percentage calculations and sums
 */
function testPercentageCalculations(
  picks: string[][],
  latestDraw: string[],
  service: DiffAnalysisService
): ValidationResult {
  const errors: string[] = [];

  // Get pattern analysis
  const analyses = service.analyzePicks(picks, latestDraw);
  const patternAnalysis = service.identifyPatterns(analyses);

  // Group patterns by position
  const patternsByPosition = new Map<number, DiffPattern[]>();
  patternAnalysis.patterns.forEach((pattern) => {
    if (!patternsByPosition.has(pattern.position)) {
      patternsByPosition.set(pattern.position, []);
    }
    patternsByPosition.get(pattern.position)!.push(pattern);
  });

  // Verify percentage calculations and sums for each position
  const totalPicks = patternAnalysis.totalPicks;
  const positionResults: any[] = [];

  for (let position = 0; position < 6; position++) {
    const patterns = patternsByPosition.get(position) || [];
    let percentageSum = 0;
    let frequencySum = 0;

    // Verify each pattern's percentage calculation
    for (const pattern of patterns) {
      // Expected percentage: (frequency / totalPicks) * 100
      const expectedPercentage = (pattern.frequency / totalPicks) * 100;
      const roundedExpected = Math.round(expectedPercentage * 100) / 100;
      const actualPercentage = pattern.percentage;

      // Check if percentage matches expected (within rounding tolerance)
      const percentageDiff = Math.abs(actualPercentage - roundedExpected);
      if (percentageDiff > 0.01) {
        errors.push(
          `Position ${position}, Diff ${pattern.diffValue}: Percentage mismatch - Expected: ${roundedExpected}, Actual: ${actualPercentage}, Frequency: ${pattern.frequency}, TotalPicks: ${totalPicks}`
        );
      }

      percentageSum += actualPercentage;
      frequencySum += pattern.frequency;
    }

    // Verify percentage sum ≤ 100% (allowing rounding tolerance)
    const percentageSumRounded = Math.round(percentageSum * 100) / 100;
    if (percentageSumRounded > 100.01) {
      errors.push(
        `Position ${position}: Percentage sum exceeds 100% - Sum: ${percentageSumRounded}%, Frequency sum: ${frequencySum}, Total picks: ${totalPicks}`
      );
    }

    // Verify frequency sum matches total picks (each pick contributes exactly one diff per position)
    // Note: This might not always be true if some picks have invalid positions
    // So we'll check if frequency sum <= totalPicks
    if (frequencySum > totalPicks) {
      errors.push(
        `Position ${position}: Frequency sum exceeds total picks - Frequency sum: ${frequencySum}, Total picks: ${totalPicks}`
      );
    }

    positionResults.push({
      position,
      patternCount: patterns.length,
      percentageSum: percentageSumRounded,
      frequencySum,
      totalPicks,
      status: percentageSumRounded <= 100.01 ? 'PASS' : 'FAIL',
    });
  }

  const status = errors.length === 0 ? 'PASS' : 'FAIL';

  return {
    testName: 'Percentage Calculation and Sum Verification',
    status,
    details: {
      totalPicks,
      positionResults,
      errors: errors.length,
      errorDetails: errors.slice(0, 10), // First 10 errors
    },
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Main validation function
 */
export async function runAgentCValidation(): Promise<DiffCalculationReport> {
  const service = new DiffAnalysisService();

  // Get latest draw
  const latestDraw = await service.getLatestDraw();
  console.log('Latest draw:', latestDraw);

  // Get sample picks (use at least 100)
  const samplePicks = allLatestPicks.slice(0, Math.max(100, allLatestPicks.length));
  console.log(`Using ${samplePicks.length} picks for validation`);

  // Run tests
  const diffTest = testDiffCalculation(samplePicks, latestDraw, service);
  const percentageTest = testPercentageCalculations(samplePicks, latestDraw, service);

  const results = [diffTest, percentageTest];
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  const report: DiffCalculationReport = {
    agent: 'Agent-C',
    timestamp: new Date().toISOString(),
    test_suite: 'Diff Analysis Math Validation',
    summary: {
      total_tests: results.length,
      passed,
      failed,
      status: failed === 0 ? 'PASS' : 'FAIL',
    },
    results: results.map((result) => ({
      test_name: result.testName,
      status: result.status,
      metric: result.details,
      expected: result.status === 'PASS' ? '100% accuracy / ≤100% sum' : 'N/A',
      tolerance: '0% error tolerance / 0.01% rounding tolerance',
      evidence: {
        errors: result.errors?.length || 0,
        errorDetails: result.errors?.slice(0, 5) || [],
      },
      sample_size: samplePicks.length,
    })),
    artifacts: [],
  };

  return report;
}

/**
 * Run validation and log results
 */
export async function executeValidation(): Promise<void> {
  try {
    console.log('='.repeat(80));
    console.log('AGENT C VALIDATION: Diff Analysis Math');
    console.log('='.repeat(80));
    console.log('');

    const report = await runAgentCValidation();

    console.log('Validation Summary:');
    console.log(`  Total Tests: ${report.summary.total_tests}`);
    console.log(`  Passed: ${report.summary.passed}`);
    console.log(`  Failed: ${report.summary.failed}`);
    console.log(`  Status: ${report.summary.status}`);
    console.log('');

    console.log('Test Results:');
    report.results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.test_name}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Sample Size: ${result.sample_size}`);
      if (result.status === 'FAIL') {
        console.log(`   Errors: ${result.evidence.errors}`);
        if (result.evidence.errorDetails && result.evidence.errorDetails.length > 0) {
          console.log('   Error Details:');
          result.evidence.errorDetails.forEach((error: string) => {
            console.log(`     - ${error}`);
          });
        }
      } else {
        console.log(`   Details:`, JSON.stringify(result.metric, null, 2));
      }
    });

    console.log('');
    console.log('='.repeat(80));

    // Write report to file
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(
      __dirname,
      '../../validation-results/agent-c-diff-calculation-report.json'
    );
    
    // Ensure directory exists
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nReport written to: ${reportPath}`);

    // Exit with appropriate code
    process.exit(report.summary.status === 'PASS' ? 0 : 1);
  } catch (error) {
    console.error('Validation failed with error:', error);
    process.exit(1);
  }
}

// If run directly
if (require.main === module) {
  executeValidation();
}
