import { Injectable } from '@angular/core';
import { GenerationStrategy, GenerationContext } from './generation-strategy.interface';

/**
 * Initial Random Strategy
 * 
 * Generates a play by randomly selecting numbers from the filtered parsed sets.
 * This is the simplest strategy with no statistical weighting.
 */
@Injectable({
  providedIn: 'root',
})
export class InitialRandomStrategy implements GenerationStrategy {
  getName(): string {
    return 'Initial Random';
  }

  async generate(context: GenerationContext): Promise<string[]> {
    const initialPlay = context.filteredParsedSets.map((set) => {
      const numbers = set.numbers;
      if (!numbers || numbers.length === 0) {
        // Fallback to random if no numbers available for this position
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

    return context.sortGeneratedSet(initialPlay);
  }
}
