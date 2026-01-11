import { Injectable } from '@angular/core';
import { PowerballDraw } from '../models/powerball-draw.interface';
import { PowerballConfigService } from './powerball-config.service';

/**
 * Pattern map for white ball co-occurrence analysis
 */
export interface WhiteBallPatternMap {
  // Maps white ball combinations to their co-occurrence frequency
  // Key: sorted white ball combo (e.g., "01,12,23,45")
  coOccurrences: Map<string, number>;
  // Key: "ball1,ball2" (sorted)
  pairFrequencies: Map<string, number>;
  // Key: "ball1,ball2,ball3" (sorted)
  tripletFrequencies: Map<string, number>;
  // Key: "ball1,ball2,ball3,ball4" (sorted)
  quadrupletFrequencies: Map<string, number>;
}

/**
 * Pattern map for white ball + powerball conditional probabilities
 */
export interface WhitePowerballPatternMap {
  // Maps white ball sets to powerball probabilities
  // Key: white combo (sorted) -> powerball -> probability
  whiteToPowerball: Map<string, Map<string, number>>;
  // Overall powerball frequencies with 3+ white matches
  powerballFrequencies: Map<string, number>;
  // Count of draws where specific white sets appeared with specific powerballs
  whitePowerballCounts: Map<string, Map<string, number>>;
}

/**
 * Service that analyzes historical Powerball draws to identify patterns
 * for target win conditions (4 white balls, 3 white + powerball).
 */
@Injectable({
  providedIn: 'root',
})
export class TargetWinPatternService {
  private fourWhitePatterns: WhiteBallPatternMap | null = null;
  private threeWhitePowerballPatterns: WhitePowerballPatternMap | null = null;
  private analyzedData: PowerballDraw[] = [];

  constructor(private configService: PowerballConfigService) {}

  /**
   * Analyzes historical draws to identify patterns for 4 white ball matches.
   * Tracks co-occurrence frequencies for pairs, triplets, and quadruplets.
   */
  analyzeFourWhitePatterns(historicalData: PowerballDraw[]): WhiteBallPatternMap {
    // Cache if we've already analyzed this data
    if (this.fourWhitePatterns && this.arraysEqual(this.analyzedData, historicalData)) {
      return this.fourWhitePatterns;
    }

    const coOccurrences = new Map<string, number>();
    const pairFrequencies = new Map<string, number>();
    const tripletFrequencies = new Map<string, number>();
    const quadrupletFrequencies = new Map<string, number>();

    // Process each historical draw
    for (const draw of historicalData) {
      const numbers = draw.winning_numbers.split(' ');
      if (numbers.length < 6) continue;

      const whiteBalls = numbers.slice(0, 5).map(n => n.padStart(2, '0')).sort();
      const powerball = numbers[5].padStart(2, '0');

      // Generate all pairs (C(5,2) = 10 combinations)
      for (let i = 0; i < whiteBalls.length; i++) {
        for (let j = i + 1; j < whiteBalls.length; j++) {
          const pair = [whiteBalls[i], whiteBalls[j]].sort().join(',');
          pairFrequencies.set(pair, (pairFrequencies.get(pair) || 0) + 1);
        }
      }

      // Generate all triplets (C(5,3) = 10 combinations)
      for (let i = 0; i < whiteBalls.length; i++) {
        for (let j = i + 1; j < whiteBalls.length; j++) {
          for (let k = j + 1; k < whiteBalls.length; k++) {
            const triplet = [whiteBalls[i], whiteBalls[j], whiteBalls[k]]
              .sort()
              .join(',');
            tripletFrequencies.set(triplet, (tripletFrequencies.get(triplet) || 0) + 1);
          }
        }
      }

      // Generate all quadruplets (C(5,4) = 5 combinations)
      for (let i = 0; i < whiteBalls.length; i++) {
        for (let j = i + 1; j < whiteBalls.length; j++) {
          for (let k = j + 1; k < whiteBalls.length; k++) {
            for (let l = k + 1; l < whiteBalls.length; l++) {
              const quadruplet = [
                whiteBalls[i],
                whiteBalls[j],
                whiteBalls[k],
                whiteBalls[l],
              ]
                .sort()
                .join(',');
              quadrupletFrequencies.set(
                quadruplet,
                (quadrupletFrequencies.get(quadruplet) || 0) + 1
              );
            }
          }
        }
      }

      // Store the full white ball combination (sorted)
      const fullCombo = whiteBalls.join(',');
      coOccurrences.set(fullCombo, (coOccurrences.get(fullCombo) || 0) + 1);
    }

    this.fourWhitePatterns = {
      coOccurrences,
      pairFrequencies,
      tripletFrequencies,
      quadrupletFrequencies,
    };

    this.analyzedData = historicalData;
    return this.fourWhitePatterns;
  }

  /**
   * Analyzes historical draws to identify patterns for 3 white + powerball matches.
   * Calculates conditional probabilities: P(powerball | white_ball_set)
   */
  analyzeThreeWhitePowerballPatterns(
    historicalData: PowerballDraw[]
  ): WhitePowerballPatternMap {
    // Cache if we've already analyzed this data
    if (
      this.threeWhitePowerballPatterns &&
      this.arraysEqual(this.analyzedData, historicalData)
    ) {
      return this.threeWhitePowerballPatterns;
    }

    const whiteToPowerball = new Map<string, Map<string, number>>();
    const powerballFrequencies = new Map<string, number>();
    const whitePowerballCounts = new Map<string, Map<string, number>>();

    // Process each historical draw
    for (const draw of historicalData) {
      const numbers = draw.winning_numbers.split(' ');
      if (numbers.length < 6) continue;

      const whiteBalls = numbers.slice(0, 5).map(n => n.padStart(2, '0')).sort();
      const powerball = numbers[5].padStart(2, '0');

      // Track overall powerball frequency
      powerballFrequencies.set(
        powerball,
        (powerballFrequencies.get(powerball) || 0) + 1
      );

      // Generate all triplets and track which powerball appeared with them
      for (let i = 0; i < whiteBalls.length; i++) {
        for (let j = i + 1; j < whiteBalls.length; j++) {
          for (let k = j + 1; k < whiteBalls.length; k++) {
            const triplet = [whiteBalls[i], whiteBalls[j], whiteBalls[k]]
              .sort()
              .join(',');

            // Initialize maps if needed
            if (!whitePowerballCounts.has(triplet)) {
              whitePowerballCounts.set(triplet, new Map<string, number>());
            }
            if (!whiteToPowerball.has(triplet)) {
              whiteToPowerball.set(triplet, new Map<string, number>());
            }

            const countMap = whitePowerballCounts.get(triplet)!;
            countMap.set(powerball, (countMap.get(powerball) || 0) + 1);
          }
        }
      }
    }

    // Calculate conditional probabilities: P(powerball | white_set)
    // Probability = count(white_set + powerball) / count(white_set with any powerball)
    for (const [whiteCombo, powerballCounts] of whitePowerballCounts.entries()) {
      const totalOccurrences = Array.from(powerballCounts.values()).reduce(
        (sum, count) => sum + count,
        0
      );

      if (totalOccurrences > 0) {
        const probabilityMap = whiteToPowerball.get(whiteCombo)!;
        for (const [pb, count] of powerballCounts.entries()) {
          const probability = count / totalOccurrences;
          probabilityMap.set(pb, probability);
        }
      }
    }

    this.threeWhitePowerballPatterns = {
      whiteToPowerball,
      powerballFrequencies,
      whitePowerballCounts,
    };

    this.analyzedData = historicalData;
    return this.threeWhitePowerballPatterns;
  }

  /**
   * Gets optimal white ball groups based on co-occurrence patterns.
   * Returns groups sorted by frequency (highest first).
   *
   * @param targetCount - Number of white balls in the group (3 or 4)
   * @returns Array of white ball groups, each as a sorted array of strings
   */
  getOptimalWhiteBallGroups(targetCount: 4 | 3): string[][] {
    if (!this.fourWhitePatterns) {
      throw new Error(
        'Patterns not analyzed. Call analyzeFourWhitePatterns() first.'
      );
    }

    let frequencyMap: Map<string, number>;
    if (targetCount === 4) {
      frequencyMap = this.fourWhitePatterns.quadrupletFrequencies;
    } else {
      frequencyMap = this.fourWhitePatterns.tripletFrequencies;
    }

    // Convert to array and sort by frequency (descending)
    const sortedGroups = Array.from(frequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([combo]) => combo.split(',').sort());

    return sortedGroups;
  }

  /**
   * Gets optimal powerball numbers for a given set of white balls.
   * Returns powerballs sorted by conditional probability (highest first).
   *
   * @param whiteBalls - Array of white ball numbers (as strings)
   * @returns Array of powerball numbers sorted by probability
   */
  getOptimalPowerballForWhites(whiteBalls: string[]): string[] {
    if (!this.threeWhitePowerballPatterns) {
      throw new Error(
        'Patterns not analyzed. Call analyzeThreeWhitePowerballPatterns() first.'
      );
    }

    // Normalize white balls (pad and sort)
    const normalizedWhites = whiteBalls
      .map((b) => b.padStart(2, '0'))
      .sort();

    // If we have exactly 3 white balls, look up the triplet directly
    if (normalizedWhites.length === 3) {
      const triplet = normalizedWhites.join(',');
      const probabilityMap = this.threeWhitePowerballPatterns.whiteToPowerball.get(
        triplet
      );

      if (probabilityMap) {
        // Sort by probability (descending)
        return Array.from(probabilityMap.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([pb]) => pb);
      }
    }

    // If we have more than 3 white balls, find all triplets and aggregate probabilities
    if (normalizedWhites.length >= 3) {
      const powerballScores = new Map<string, number>();

      // Generate all triplets from the white balls
      for (let i = 0; i < normalizedWhites.length; i++) {
        for (let j = i + 1; j < normalizedWhites.length; j++) {
          for (let k = j + 1; k < normalizedWhites.length; k++) {
            const triplet = [
              normalizedWhites[i],
              normalizedWhites[j],
              normalizedWhites[k],
            ]
              .sort()
              .join(',');

            const probabilityMap =
              this.threeWhitePowerballPatterns.whiteToPowerball.get(triplet);

            if (probabilityMap) {
              // Aggregate probabilities (sum them up)
              for (const [pb, prob] of probabilityMap.entries()) {
                powerballScores.set(pb, (powerballScores.get(pb) || 0) + prob);
              }
            }
          }
        }
      }

      // Sort by aggregated score (descending)
      return Array.from(powerballScores.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([pb]) => pb);
    }

    // Fallback: return powerballs sorted by overall frequency
    return Array.from(this.threeWhitePowerballPatterns.powerballFrequencies.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([pb]) => pb);
  }

  /**
   * Clears cached pattern data. Useful when new historical data is available.
   */
  clearCache(): void {
    this.fourWhitePatterns = null;
    this.threeWhitePowerballPatterns = null;
    this.analyzedData = [];
  }

  /**
   * Helper method to check if two arrays of PowerballDraw are equal.
   * Used for caching validation.
   */
  private arraysEqual(arr1: PowerballDraw[], arr2: PowerballDraw[]): boolean {
    if (arr1.length !== arr2.length) return false;
    return arr1.every(
      (draw, index) =>
        draw.draw_date === arr2[index].draw_date &&
        draw.winning_numbers === arr2[index].winning_numbers
    );
  }

  /**
   * Gets the co-occurrence threshold from config or uses a default.
   */
  private getCoOccurrenceThreshold(): number {
    // Try to get from config, fallback to 2
    try {
      const config = this.configService.getConfig();
      // This would need to be added to the config interface
      // For now, use a reasonable default
      return 2;
    } catch {
      return 2;
    }
  }
}
