import { Injectable } from '@angular/core';
import { PowerballData } from '../data/powerball-data';
import {
  PickDiffAnalysis,
  BallDiff,
  DiffPattern,
  DiffPatternAnalysis,
} from '../models/powerball-draw.interface';

@Injectable({
  providedIn: 'root',
})
export class DiffAnalysisService {
  constructor() {}

  /**
   * Analyzes an array of picks against the latest draw, calculating
   * position-based differences for each pick.
   *
   * @param picks - Array of picks to analyze (each pick is string[] of length 6)
   * @param latestDraw - The latest draw numbers (string[] of length 6)
   * @returns Array of PickDiffAnalysis objects, one for each pick
   */
  analyzePicks(picks: string[][], latestDraw: string[]): PickDiffAnalysis[] {
    if (!picks || picks.length === 0) {
      return [];
    }

    if (!latestDraw || latestDraw.length !== 6) {
      throw new Error('Latest draw must be an array of 6 numbers');
    }

    return picks.map((pick) => {
      if (!pick || pick.length !== 6) {
        // Skip invalid picks, but still return an analysis object
        return {
          pick: pick || [],
          ballDiffs: [],
        };
      }

      const ballDiffs: BallDiff[] = [];

      // Calculate diff for each position (0-5)
      for (let i = 0; i < 6; i++) {
        const pickValue = pick[i];
        const drawValue = latestDraw[i];

        // Parse as integers for calculation
        const pickNum = parseInt(pickValue, 10);
        const drawNum = parseInt(drawValue, 10);

        // Skip if parsing fails
        if (isNaN(pickNum) || isNaN(drawNum)) {
          continue;
        }

        // Calculate difference: pick[i] - draw[i]
        const diff = pickNum - drawNum;

        // Format diff as string (e.g., "+1", "-5", "+10", "0")
        const diffString = diff > 0 ? `+${diff}` : diff.toString();

        ballDiffs.push({
          position: i,
          pickValue,
          drawValue,
          diff,
          diffString,
        });
      }

      return {
        pick,
        ballDiffs,
      };
    });
  }

  /**
   * Identifies recurring diff patterns across all analyzed picks.
   * Groups diffs by position and diff value, calculating frequency and percentage.
   *
   * @param analyses - Array of PickDiffAnalysis objects from analyzePicks()
   * @returns DiffPatternAnalysis with patterns sorted by frequency
   */
  identifyPatterns(analyses: PickDiffAnalysis[]): DiffPatternAnalysis {
    if (!analyses || analyses.length === 0) {
      return {
        patterns: [],
        totalPicks: 0,
        latestDraw: [],
      };
    }

    // Extract latest draw from first analysis (all should have same latestDraw)
    // We'll need to track this separately since it's not in PickDiffAnalysis
    // For now, we'll get it from the first analysis's ballDiffs
    const latestDraw: string[] = [];
    if (analyses.length > 0 && analyses[0].ballDiffs.length > 0) {
      analyses[0].ballDiffs.forEach((ballDiff) => {
        latestDraw[ballDiff.position] = ballDiff.drawValue;
      });
    }

    // Map to track patterns: Map<position, Map<diffValue, count>>
    const patternMap = new Map<number, Map<number, number>>();

    // Count occurrences of each position-diff combination
    analyses.forEach((analysis) => {
      analysis.ballDiffs.forEach((ballDiff) => {
        const position = ballDiff.position;
        const diffValue = ballDiff.diff;

        if (!patternMap.has(position)) {
          patternMap.set(position, new Map<number, number>());
        }

        const positionMap = patternMap.get(position)!;
        const currentCount = positionMap.get(diffValue) || 0;
        positionMap.set(diffValue, currentCount + 1);
      });
    });

    // Convert to DiffPattern array
    const patterns: DiffPattern[] = [];
    const totalPicks = analyses.length;

    patternMap.forEach((positionMap, position) => {
      positionMap.forEach((frequency, diffValue) => {
        const percentage = (frequency / totalPicks) * 100;

        patterns.push({
          position,
          diffValue,
          frequency,
          percentage: Math.round(percentage * 100) / 100, // Round to 2 decimal places
        });
      });
    });

    // Sort by frequency (descending), then by position, then by diffValue
    patterns.sort((a, b) => {
      if (b.frequency !== a.frequency) {
        return b.frequency - a.frequency;
      }
      if (a.position !== b.position) {
        return a.position - b.position;
      }
      return a.diffValue - b.diffValue;
    });

    return {
      patterns,
      totalPicks,
      latestDraw,
    };
  }

  /**
   * Fetches the latest draw from PowerballData.
   * The latest draw is the first element (index 0) in the PowerballData array.
   *
   * @returns Promise resolving to the latest draw numbers array (string[] of length 6)
   */
  async getLatestDraw(): Promise<string[]> {
    try {
      if (!PowerballData || PowerballData.length === 0) {
        throw new Error('PowerballData is empty or not available');
      }

      const latestDrawData = PowerballData[0];

      if (!latestDrawData || !latestDrawData.winning_numbers) {
        throw new Error('Latest draw data is invalid');
      }

      const numbers = latestDrawData.winning_numbers.split(' ');

      if (!numbers || numbers.length !== 6) {
        throw new Error('Latest draw does not have 6 numbers');
      }

      return numbers;
    } catch (error) {
      console.error('Error fetching latest draw:', error);
      throw error;
    }
  }
}
