import { Injectable } from '@angular/core';
import { GenerationStrategy, GenerationContext } from './generation-strategy.interface';
import { PowerballConfigService } from '../powerball-config.service';

/**
 * Highest Probability Strategy
 * 
 * Generates a play by selecting numbers with the highest probability
 * based on recency-weighted frequency analysis.
 */
@Injectable({
  providedIn: 'root',
})
export class HighestProbabilityStrategy implements GenerationStrategy {
  constructor(private configService: PowerballConfigService) {}

  getName(): string {
    return 'Highest Probability';
  }

  async generate(context: GenerationContext): Promise<string[]> {
    const highestProbabilityPlay = context.filteredParsedSets.map((set) => {
      const numbers = set.numbers;
      const strNums: string[] = [];

      if (!numbers || numbers.length === 0) {
        // Fallback to random if no numbers available
        const isPowerball = set.key === 'powerball';
        return context.randomNumberInRange(
          isPowerball ? 1 : 1,
          isPowerball ? 26 : 69
        );
      }

      numbers.forEach((num: any) => {
        const strN = typeof num === 'number' 
          ? num.toString().padStart(2, '0')
          : (num.length === 1 ? `0${num}` : num.toString());
        strNums.push(strN);
      });

      // Weighted pick with recency
      const recencyThreshold = this.configService.get('recencyThreshold');
      return context.pickAdvancedProbabilityNumberWithRecency(strNums, recencyThreshold);
    });

    return context.sortGeneratedSet(highestProbabilityPlay);
  }
}
