import { Injectable } from '@angular/core';
import { GenerationStrategy, GenerationContext } from './generation-strategy.interface';

/**
 * Predictive Weighted Random Strategy
 * 
 * Generates a play by:
 * 1. Selecting a weighted random first number (based on frequency)
 * 2. Building subsequent numbers using synergy-based transitions
 * 3. Using weighted probability for powerball selection
 */
@Injectable({
  providedIn: 'root',
})
export class PredictiveWeightedRandomStrategy implements GenerationStrategy {
  getName(): string {
    return 'Predictive Weighted Random';
  }

  async generate(context: GenerationContext): Promise<string[]> {
    // Generate initial random play as base
    const initialPlay = context.filteredParsedSets.map((set) => {
      const numbers = set.numbers;
      if (!numbers || numbers.length === 0) {
        const isPowerball = set.key === 'powerball';
        return context.randomNumberInRange(
          isPowerball ? 1 : 1,
          isPowerball ? 26 : 69
        );
      }
      const randomNumber = numbers[Math.floor(Math.random() * numbers.length)];
      return typeof randomNumber === 'number'
        ? randomNumber.toString().padStart(2, '0')
        : randomNumber;
    });

    // Pick weighted random first number
    const firstPredictedNumber = context.pickWeightedRandomFirstNumber();

    // Build play with the selected first number
    const predictiveWeightedRandomPlay = context.buildWithTheFirst(
      firstPredictedNumber,
      initialPlay
    );

    return context.sortGeneratedSet(predictiveWeightedRandomPlay);
  }
}
