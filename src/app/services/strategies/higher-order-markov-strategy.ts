import { Injectable } from '@angular/core';
import _ from 'lodash';
import { GenerationStrategy, GenerationContext } from './generation-strategy.interface';
import { PowerballConfigService } from '../powerball-config.service';

/**
 * Higher-Order Markov Chain Strategy
 * 
 * Generates a play using higher-order Markov chains that track transitions
 * based on pairs of consecutive numbers, providing more sophisticated pattern recognition.
 */
@Injectable({
  providedIn: 'root',
})
export class HigherOrderMarkovStrategy implements GenerationStrategy {
  private higherOrderSynergyMap: { [pairKey: string]: { [next: string]: number } } = {};

  constructor(private configService: PowerballConfigService) {}

  getName(): string {
    return 'Higher-Order Markov';
  }

  async generate(context: GenerationContext): Promise<string[]> {
    // Build the higher-order synergy map
    this.buildHigherOrderSynergyMap(context.historicalData);

    // Pick the first white ball using weighted random selection
    const firstWhiteBall = this.pickWeightedRandomFirstNumber(context);

    // Build the full play using higher-order synergy
    const play = this.buildPlayWithSynergy(context, firstWhiteBall);

    // Sort and enforce valid ranges
    return this.sortAndEnforceRange(play);
  }

  /**
   * Builds the higher-order synergy map by iterating through historical draws.
   * For every pair of consecutive white balls (e.g., "12-25"), records the frequency of the following number.
   */
  private buildHigherOrderSynergyMap(historicalData: string[][]): void {
    this.higherOrderSynergyMap = {};
    for (const row of historicalData) {
      if (row.length < 3) continue;
      for (let i = 0; i < row.length - 2; i++) {
        const pairKey = `${row[i]}-${row[i + 1]}`;
        const nextNum = row[i + 2];
        if (!this.higherOrderSynergyMap[pairKey]) {
          this.higherOrderSynergyMap[pairKey] = {};
        }
        this.higherOrderSynergyMap[pairKey][nextNum] = (this.higherOrderSynergyMap[pairKey][nextNum] || 0) + 1;
      }
    }
  }

  /**
   * Constructs the play using higher-order synergy:
   * - First white ball: weighted random from historical data
   * - Second white ball: first-order synergy (only one previous white ball exists)
   * - White balls 3-5: higher-order synergy (based on last two white balls)
   * - Powerball: weighted random selection
   */
  private buildPlayWithSynergy(context: GenerationContext, firstWhiteBall: string): string[] {
    const whiteBalls: string[] = [firstWhiteBall];

    // For the second white ball, use first-order synergy
    const firstOrderCandidates = this.generateNextNumberCandidates(context, whiteBalls[0], 0);
    let secondWhiteBall: string;
    if (firstOrderCandidates.length) {
      const freqMap = this.createFrequencyMap(firstOrderCandidates);
      const weighted = this.buildWeightedArrayFromMap(freqMap);
      secondWhiteBall = this.pickRandomFromWeightedArray(weighted, firstOrderCandidates);
    } else {
      const whiteBallRange = this.configService.get('whiteBallRange');
      secondWhiteBall = context.randomNumberInRange(whiteBallRange.min, whiteBallRange.max);
    }
    whiteBalls.push(secondWhiteBall);

    // For white balls 3-5, use higher-order synergy (needs two previous white balls)
    while (whiteBalls.length < 5) {
      const previousTwo = whiteBalls.slice(-2);
      const nextWhiteBall = this.pickNextNumberHigherOrder(previousTwo);
      whiteBalls.push(nextWhiteBall);
    }

    // For the powerball (6th number), select using weighted random
    const powerball = this.pickWeightedRandomFirstNumber(context, true);

    return [...whiteBalls, powerball];
  }

  /**
   * Generates candidate numbers using first-order synergy map.
   */
  private generateNextNumberCandidates(context: GenerationContext, selectedNumber: string, positionIndex: number): string[] {
    const synergyCandidates = this.getSynergyCandidates(context, positionIndex, selectedNumber);
    if (synergyCandidates.length === 0) {
      const candidates: string[] = [];
      const whiteBallDraws = context.historicalData.map(row => row.slice(0, 5));
      for (const row of whiteBallDraws) {
        if (row[positionIndex] === selectedNumber && row[positionIndex + 1]) {
          candidates.push(row[positionIndex + 1]);
        }
      }
      return candidates;
    }
    return synergyCandidates;
  }

  /**
   * Retrieves candidate numbers from the first-order synergy map.
   */
  private getSynergyCandidates(context: GenerationContext, positionIndex: number, currentNumber: string): string[] {
    const candidates: string[] = [];
    if (!context.synergyMap[positionIndex] || !context.synergyMap[positionIndex][currentNumber]) {
      return candidates;
    }
    const synergyObject = context.synergyMap[positionIndex][currentNumber];
    for (const [nextNum, count] of Object.entries(synergyObject)) {
      for (let i = 0; i < count; i++) {
        candidates.push(nextNum);
      }
    }
    return candidates;
  }

  /**
   * Picks the next white-ball number based on the last two white balls using higher-order synergy map.
   */
  private pickNextNumberHigherOrder(previousTwo: string[]): string {
    const pairKey = previousTwo.join('-');
    const candidateMap = this.higherOrderSynergyMap[pairKey];
    if (candidateMap) {
      const candidates: string[] = [];
      for (const [num, count] of Object.entries(candidateMap)) {
        for (let i = 0; i < count; i++) {
          candidates.push(num);
        }
      }
      if (candidates.length) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
    }
    const whiteBallRange = this.configService.get('whiteBallRange');
    return this.randomNumberInRange(whiteBallRange.min, whiteBallRange.max);
  }

  /**
   * Sorts the first five numbers (white balls) in ascending order and enforces valid ranges.
   */
  private sortAndEnforceRange(play: string[]): string[] {
    const whiteBallRange = this.configService.get('whiteBallRange');
    const powerballRange = this.configService.get('powerballRange');
    const whiteBalls = play.slice(0, 5).map(num => {
      let n = parseInt(num, 10);
      if (n < whiteBallRange.min) n = whiteBallRange.min;
      if (n > whiteBallRange.max) n = whiteBallRange.max;
      return n;
    });
    whiteBalls.sort((a, b) => a - b);
    const formattedWhiteBalls = whiteBalls.map(n => n.toString().padStart(2, '0'));

    let pb = parseInt(play[5], 10);
    if (pb < powerballRange.min) pb = powerballRange.min;
    if (pb > powerballRange.max) pb = powerballRange.max;
    const formattedPb = pb.toString().padStart(2, '0');

    return [...formattedWhiteBalls, formattedPb];
  }

  private pickWeightedRandomFirstNumber(context: GenerationContext, isPowerball: boolean = false): string {
    const index = isPowerball ? 5 : 0;
    const numbers = context.historicalData.map(row => row[index]);
    const frequencyMap = this.createFrequencyMap(numbers);
    const weighted = this.buildWeightedArrayFromMap(frequencyMap);
    if (weighted.length === 0) {
      return numbers[Math.floor(Math.random() * numbers.length)] || '01';
    }
    return weighted[Math.floor(Math.random() * weighted.length)];
  }

  private createFrequencyMap(arr: string[]): Record<string, number> {
    return arr.reduce((acc, cur) => {
      acc[cur] = (acc[cur] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private buildWeightedArrayFromMap(freqMap: Record<string, number>): string[] {
    const weighted: string[] = [];
    for (const [num, count] of Object.entries(freqMap)) {
      for (let i = 0; i < count; i++) {
        weighted.push(num);
      }
    }
    return weighted;
  }

  private pickRandomFromWeightedArray(weighted: string[], fallback: string[]): string {
    if (weighted.length === 0) {
      return fallback[Math.floor(Math.random() * fallback.length)];
    }
    return weighted[Math.floor(Math.random() * weighted.length)];
  }

  private randomNumberInRange(min: number, max: number): string {
    const rand = Math.floor(Math.random() * (max - min + 1)) + min;
    return rand.toString().padStart(2, '0');
  }
}
