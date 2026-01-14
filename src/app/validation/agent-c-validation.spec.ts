/**
 * Agent C Validation Test Suite
 * 
 * Validates:
 * 1. Diff calculation correctness (manual vs computed, N≥100 picks)
 * 2. Percentage calculations and sums (must be ≤100% per position)
 */

import { DiffAnalysisService } from '../services/diff-analysis.service';
import { allLatestPicks } from '../data/test-latest';
import { BallDiff } from '../models/powerball-draw.interface';

describe('Agent C: Diff Analysis Math Validation', () => {
  let service: DiffAnalysisService;
  let latestDraw: string[];

  beforeAll(async () => {
    service = new DiffAnalysisService();
    latestDraw = await service.getLatestDraw();
  });

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

  describe('Test 1: Diff Calculation Verification', () => {
    it('should calculate diffs correctly for N≥100 picks', () => {
      // Get sample picks (use at least 100)
      const samplePicks = allLatestPicks.slice(0, Math.max(100, allLatestPicks.length));
      expect(samplePicks.length).toBeGreaterThanOrEqual(100);

      const errors: string[] = [];
      let matchCount = 0;
      let totalComparisons = 0;

      // Compute diffs using service
      const serviceAnalyses = service.analyzePicks(samplePicks, latestDraw);

      // Compare each pick's diffs manually vs service
      for (let i = 0; i < samplePicks.length; i++) {
        const pick = samplePicks[i];
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

      // Log results
      console.log(`\nDiff Calculation Test Results:`);
      console.log(`  Total Picks: ${samplePicks.length}`);
      console.log(`  Total Comparisons: ${totalComparisons}`);
      console.log(`  Matches: ${matchCount}`);
      console.log(`  Accuracy: ${accuracy.toFixed(2)}%`);
      console.log(`  Errors: ${errors.length}`);

      if (errors.length > 0) {
        console.log(`  First 10 Errors:`);
        errors.slice(0, 10).forEach((error) => console.log(`    - ${error}`));
      }

      // Assertions
      expect(errors.length).toBe(0);
      expect(accuracy).toBe(100);
      expect(totalComparisons).toBeGreaterThan(0);
    });
  });

  describe('Test 2: Percentage Calculation and Sum Verification', () => {
    it('should calculate percentages correctly and sum ≤100% per position', () => {
      // Get sample picks (use at least 100)
      const samplePicks = allLatestPicks.slice(0, Math.max(100, allLatestPicks.length));
      expect(samplePicks.length).toBeGreaterThanOrEqual(100);

      const errors: string[] = [];

      // Get pattern analysis
      const analyses = service.analyzePicks(samplePicks, latestDraw);
      const patternAnalysis = service.identifyPatterns(analyses);

      // Group patterns by position
      const patternsByPosition = new Map<number, typeof patternAnalysis.patterns>();
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
          // The service rounds to 2 decimal places: Math.round(percentage * 100) / 100
          const serviceRounded = Math.round(expectedPercentage * 100) / 100;
          const percentageDiff = Math.abs(actualPercentage - serviceRounded);
          if (percentageDiff > 0.005) { // Allow for rounding differences
            errors.push(
              `Position ${position}, Diff ${pattern.diffValue}: Percentage mismatch - Expected: ${serviceRounded}, Actual: ${actualPercentage}, Frequency: ${pattern.frequency}, TotalPicks: ${totalPicks}`
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

      // Log results
      console.log(`\nPercentage Calculation Test Results:`);
      console.log(`  Total Picks: ${totalPicks}`);
      console.log(`  Errors: ${errors.length}`);
      console.log(`  Position Results:`);
      positionResults.forEach((result) => {
        console.log(
          `    Position ${result.position}: ${result.patternCount} patterns, Sum: ${result.percentageSum}%, Status: ${result.status}`
        );
      });

      if (errors.length > 0) {
        console.log(`  First 10 Errors:`);
        errors.slice(0, 10).forEach((error) => console.log(`    - ${error}`));
      }

      // Assertions
      expect(errors.length).toBe(0);
      positionResults.forEach((result) => {
        expect(result.percentageSum).toBeLessThanOrEqual(100.01);
      });
    });
  });
});
