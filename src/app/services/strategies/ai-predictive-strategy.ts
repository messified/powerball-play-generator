import { Injectable } from '@angular/core';
import _ from 'lodash';
import { GenerationStrategy, GenerationContext } from './generation-strategy.interface';
import { PowerballConfigService } from '../powerball-config.service';

/**
 * AI Predictive Strategy
 * 
 * Generates a play using synergy-based logic with advanced recency weighting.
 * Includes fallback logic and random offset to avoid repetitive patterns.
 */
@Injectable({
  providedIn: 'root',
})
export class AiPredictiveStrategy implements GenerationStrategy {
  constructor(private configService: PowerballConfigService) {}

  getName(): string {
    return 'AI Predictive';
  }

  async generate(context: GenerationContext): Promise<string[]> {
    // AI Predictive strategy generates a single play, not one per set
    // If filteredParsedSets is empty or invalid, fallback to random picks
    if (!context.filteredParsedSets || context.filteredParsedSets.length === 0) {
      return context.generateFallbackSet();
    }

    const synergyBasedPick: string[] = [];
    
    // Get first position's numbers as seed
    const firstSet = context.filteredParsedSets.find(s => s.key === 'first');
    let currentPick: string;
    if (firstSet && firstSet.numbers && firstSet.numbers.length > 0) {
      currentPick = firstSet.numbers[Math.floor(Math.random() * firstSet.numbers.length)].toString().padStart(2, '0');
    } else {
      currentPick = context.randomNumberInRange(1, 69);
    }

    // Fill first 5 positions using synergy + recency weighting
    for (let i = 0; i < 5; i++) {
      // Synergy approach
      const synergyCandidates = context.generateNextNumberArray(currentPick, i);

      // Fallback if synergy is empty
      if (!synergyCandidates || !synergyCandidates.length) {
        // Fallback to random from 1..69
        const fallback = context.randomNumberInRange(1, 69);
        synergyBasedPick.push(fallback);
        currentPick = fallback;
        continue;
      }

      const uniqueCandidates = _.uniq(synergyCandidates);

      // Use advanced recency weighting
      let chosen = context.pickAdvancedProbabilityNumber(uniqueCandidates);

      // Fallback if chosen is empty
      if (!chosen) {
        chosen = context.randomNumberInRange(1, 69);
      }

      // Mild random offset chance to avoid repetitive patterns
      const randomOffsetChance = this.configService.get('randomOffsetChance');
      if (Math.random() < randomOffsetChance) {
        const randomAlt = context.randomNumberInRange(1, 69);
        chosen = randomAlt;
      }

      synergyBasedPick.push(chosen);
      currentPick = chosen;
    }

    // Choose powerball with synergy or random
    const chosenPB = context.pickPowerballAi();

    // Enforce PB range
    const numericPB = parseInt(chosenPB, 10);
    const validPB =
      numericPB < 1 || numericPB > 26
        ? this.fallbackPowerballValue(numericPB)
        : chosenPB;

    const play = [...synergyBasedPick, validPB];
    return context.sortGeneratedSet(play);
  }

  private fallbackPowerballValue(num: number): string {
    if (num < 1) return '01';
    if (num > 26) return '26';
    return num.toString().padStart(2, '0');
  }
}
