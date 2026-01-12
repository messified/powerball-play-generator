import { Injectable } from '@angular/core';
import { GenerationStrategy, GenerationContext } from './generation-strategy.interface';
import { DiffPattern } from '../../models/powerball-draw.interface';

/**
 * Diff Pattern Strategy
 * 
 * Generates a play by:
 * 1. Using identified diff patterns from previous picks analysis
 * 2. For each position, selecting a diff pattern weighted by frequency
 * 3. Applying the selected diff to the latest draw's number at that position
 * 4. Ensuring numbers stay within valid ranges (1-69 for white balls, 1-26 for powerball)
 */
@Injectable({
  providedIn: 'root',
})
export class DiffPatternStrategy implements GenerationStrategy {
  getName(): string {
    return 'Diff Pattern';
  }

  async generate(context: GenerationContext): Promise<string[]> {
    // Check if diff patterns are available
    if (!context.diffPatterns || !context.diffPatterns.patterns || context.diffPatterns.patterns.length === 0) {
      // Fallback to default strategy if no patterns available
      return context.generateFallbackSet();
    }

    const { patterns, latestDraw } = context.diffPatterns;

    // Validate latest draw
    if (!latestDraw || latestDraw.length !== 6) {
      return context.generateFallbackSet();
    }

    const generatedPlay: string[] = [];

    // Process each position (0-5: first 5 are white balls, position 5 is powerball)
    for (let position = 0; position < 6; position++) {
      const isPowerball = position === 5;
      const minValue = isPowerball ? 1 : 1;
      const maxValue = isPowerball ? 26 : 69;

      // Filter patterns for this position
      const positionPatterns = patterns.filter(p => p.position === position);

      // If no patterns for this position, use random fallback
      if (positionPatterns.length === 0) {
        const randomNum = context.randomNumberInRange(minValue, maxValue);
        generatedPlay.push(randomNum);
        continue;
      }

      // Select a pattern weighted by frequency/percentage
      const selectedPattern = this.selectWeightedPattern(positionPatterns);

      // Get the latest draw's number at this position
      const latestDrawValue = parseInt(latestDraw[position], 10);

      // If parsing fails, use random fallback
      if (isNaN(latestDrawValue)) {
        const randomNum = context.randomNumberInRange(minValue, maxValue);
        generatedPlay.push(randomNum);
        continue;
      }

      // Apply the diff to the latest draw's number
      let newValue = latestDrawValue + selectedPattern.diffValue;

      // Clamp to valid range
      newValue = Math.max(minValue, Math.min(maxValue, newValue));

      // Format with zero padding
      const formattedValue = newValue.toString().padStart(2, '0');
      generatedPlay.push(formattedValue);
    }

    // Sort and return the generated play
    return context.sortGeneratedSet(generatedPlay);
  }

  /**
   * Selects a pattern from the available patterns, weighted by frequency/percentage.
   * Uses a weighted random selection where patterns with higher frequency
   * have a higher probability of being selected.
   * 
   * @param positionPatterns - Array of patterns for a specific position
   * @returns The selected pattern
   */
  private selectWeightedPattern(positionPatterns: DiffPattern[]): DiffPattern {
    // If only one pattern, return it
    if (positionPatterns.length === 1) {
      return positionPatterns[0];
    }

    // Calculate total weight (sum of frequencies)
    const totalWeight = positionPatterns.reduce((sum, pattern) => sum + pattern.frequency, 0);

    // If total weight is 0, return the first pattern
    if (totalWeight === 0) {
      return positionPatterns[0];
    }

    // Generate a random number between 0 and totalWeight
    let random = Math.random() * totalWeight;

    // Select pattern based on weighted random
    for (const pattern of positionPatterns) {
      random -= pattern.frequency;
      if (random <= 0) {
        return pattern;
      }
    }

    // Fallback (should not reach here, but just in case)
    return positionPatterns[0];
  }
}
