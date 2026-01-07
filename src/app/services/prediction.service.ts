import { Injectable } from '@angular/core';
import { PowerballData } from '../data/powerball-data';
import _ from 'lodash';
import { FutureGeneratedDraws } from '../data/future-data';
import { PowerballDataMinusLatest } from '../data/historical-data';
import { PowerballConfigService } from './powerball-config.service';

export interface IWinningsResponse {
  draw_date: string;
  winning_numbers: string;
  multiplier: string;
}

export interface IParsedWinningsResponse {
  date: string;
  numbers: string[];
  multiplier: string;
}

@Injectable({
  providedIn: 'root',
})
export class PredictionService {
  private powerballData: any[] = [];
  private historicalData: string[][] = [];

  /**
   * The first-order synergy map tracks, for each white-ball position (0–4),
   * the frequency with which a number is followed by another.
   */
  private synergyMap: { [positionIndex: number]: { [currentNum: string]: { [nextNum: string]: number } } } = {};

  /**
   * The higher-order synergy map tracks transitions based on pairs of consecutive numbers.
   * The key is in the form "num1-num2" and maps to an object whose keys are the candidate numbers and values are their frequencies.
   */
  private higherOrderSynergyMap: { [pairKey: string]: { [next: string]: number } } = {};

  // Service-specific config (uses prediction service overrides)
  private config = this.configService.getServiceConfig('prediction');

  constructor(private configService: PowerballConfigService) {}

  /**
   * Main entry point.
   * 1. Loads and parses historical data.
   * 2. Builds both first‑order and higher‑order synergy maps.
   * 3. Constructs a play using the Higher‑Order Markov Chain approach.
   * 4. Returns the final, formatted set of numbers.
   * 
   * @param trainingData Optional training data for backtesting. If not provided, uses PowerballDataMinusLatest.
   */
  async generatePowerballPlay(trainingData?: any[]): Promise<string[]> {
    // Load and format historical data.
    // If trainingData is provided (for backtesting), use it; otherwise use default
    this.powerballData = trainingData || PowerballDataMinusLatest;
    const formattedData = this.powerballData.map((result: { draw_date: any; winning_numbers: string; multiplier: any; }) => ({
      date: result.draw_date,
      numbers: result.winning_numbers.split(' '),
      multiplier: result.multiplier || '01',
    }));

    // Parse winning numbers and build the first-order synergy map.
    const parsedSets = await this.parseWinningNumbers(formattedData);
    // (Optional) filter historical sets.
    await this.filterParsedNumberSets(parsedSets);

    // Build the higher‑order synergy map.
    this.buildHigherOrderSynergyMap();

    // Pick the first white ball using a weighted random selection.
    const firstWhiteBall = this.pickWeightedRandomFirstNumber();

    // Build the full play using our Higher‑Order Markov Chain approach.
    const play = this.buildPlayWithSynergy(firstWhiteBall);

    // Sort the white balls and enforce valid ranges.
    return this.sortAndEnforceRange(play);
  }

  /**
   * Optionally predicts a play based on a predicted powerball.
   */
  predictPlayBasedOnPredictedPowerball(): string[] {
    const predictedPB = this.predictNextPowerball();
    const likelyFirstWhiteBall = this.predictFirstNumberBasedOnPowerball(predictedPB);
    const play = this.buildPlayWithSynergy(likelyFirstWhiteBall);
    // Override the powerball with our predicted powerball.
    play[5] = predictedPB;
    return this.sortAndEnforceRange(play);
  }

  /**
   * Predicts the next powerball number using a weighted random selection (based on historical frequency).
   */
  private predictNextPowerball(): string {
    return this.pickWeightedRandomFirstNumber(true);
  }

  /**
   * Given a predicted powerball number, this method finds historical draws with that powerball,
   * extracts the first white ball from those draws, and returns a weighted random candidate.
   * Falls back to the overall first white ball selection if no matching draws are found.
   */
  private predictFirstNumberBasedOnPowerball(predictedPB: string): string {
    const matchingDraws = this.historicalData.filter(row => row[5] === predictedPB);
    if (matchingDraws.length === 0) {
      return this.pickWeightedRandomFirstNumber();
    }
    const firstNumbers = matchingDraws.map(row => row[0]);
    const freqMap = this.createFrequencyMap(firstNumbers);
    const weightedCandidates = this.buildWeightedArrayFromMap(freqMap);
    return weightedCandidates[Math.floor(Math.random() * weightedCandidates.length)];
  }

  /**
   * Constructs the play:
   * - The first white ball is selected using historical weighted frequency.
   * - The second white ball uses first‑order synergy (since only one previous white ball exists).
   * - White balls 3–5 use the higher‑order synergy map (based on the last two white balls).
   * - The powerball is selected using weighted random selection.
   */
  private buildPlayWithSynergy(firstWhiteBall: string): string[] {
    const whiteBalls: string[] = [firstWhiteBall];

    // For the second white ball, use first‑order synergy.
    const firstOrderCandidates = this.generateNextNumberCandidates(whiteBalls[0], 0);
    let secondWhiteBall: string;
    if (firstOrderCandidates.length) {
      secondWhiteBall = this.pickRandomFromWeightedArray(
        this.buildWeightedArrayFromMap(this.createFrequencyMap(firstOrderCandidates)),
        firstOrderCandidates
      );
    } else {
      const whiteBallRange = this.config.whiteBallRange!;
      secondWhiteBall = this.randomNumberInRange(whiteBallRange.min, whiteBallRange.max);
    }
    whiteBalls.push(secondWhiteBall);

    // For white balls 3–5, use higher‑order synergy (needs two previous white balls).
    while (whiteBalls.length < 5) {
      const previousTwo = whiteBalls.slice(-2);
      const nextWhiteBall = this.pickNextNumberHigherOrder(previousTwo);
      whiteBalls.push(nextWhiteBall);
    }

    // For the powerball (6th number), select using weighted random.
    const powerball = this.pickWeightedRandomFirstNumber(true);

    return [...whiteBalls, powerball];
  }

  /**
   * Sorts the first five numbers (white balls) in ascending order and enforces the valid number range.
   * The powerball (6th number) is processed separately.
   */
  private sortAndEnforceRange(play: string[]): string[] {
    const whiteBallRange = this.config.whiteBallRange!;
    const powerballRange = this.config.powerballRange!;
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

  /**
   * Parses historical results to store draws and build the first‑order synergy map.
   */
  private async parseWinningNumbers(results: any[]): Promise<any[]> {
    const plays = results.map(set => set.numbers);
    this.historicalData = _.cloneDeep(plays);

    // Initialize the first‑order synergy map for white-ball positions.
    for (let i = 0; i < 5; i++) {
      this.synergyMap[i] = {};
    }
    for (const row of plays) {
      for (let pos = 0; pos < 4; pos++) {
        const current = row[pos];
        const next = row[pos + 1];
        if (!this.synergyMap[pos][current]) {
          this.synergyMap[pos][current] = {};
        }
        this.synergyMap[pos][current][next] = (this.synergyMap[pos][current][next] || 0) + 1;
      }
    }
    return plays.map(set => ({
      numbers: set,
      powerball: set[5],
    }));
  }

  /**
   * Optionally filters the parsed sets based on duplicate-occurrence thresholds.
   */
  private async filterParsedNumberSets(numberSets: any[] = []): Promise<{ key: string; numbers: number[] }[]> {
    const positions = ['first', 'second', 'third', 'fourth', 'fifth', 'powerball'];
    const parsedNumberSets: Record<string, number[]> = {
      first: [],
      second: [],
      third: [],
      fourth: [],
      fifth: [],
      powerball: [],
    };

    for (const set of numberSets) {
      parsedNumberSets['first'].push(parseInt(set.numbers[0], 10));
      parsedNumberSets['second'].push(parseInt(set.numbers[1], 10));
      parsedNumberSets['third'].push(parseInt(set.numbers[2], 10));
      parsedNumberSets['fourth'].push(parseInt(set.numbers[3], 10));
      parsedNumberSets['fifth'].push(parseInt(set.numbers[4], 10));
      parsedNumberSets['powerball'].push(parseInt(set.numbers[5], 10));
    }

    const whiteBallRange = this.config.whiteBallRange!;
    const powerballRange = this.config.powerballRange!;
    const whiteBallDupThreshold = this.config.whiteBallDupThreshold!;
    const powerballDupThreshold = this.config.powerballDupThreshold!;
    const filteredNumbers: { key: string; numbers: number[] }[] = [];
    for (const key of positions) {
      const arr = parsedNumberSets[key].filter(num => {
        if (key === 'powerball') {
          return num >= powerballRange.min && num <= powerballRange.max;
        }
        return num >= whiteBallRange.min && num <= whiteBallRange.max;
      });
      const threshold = key === 'powerball' ? powerballDupThreshold : whiteBallDupThreshold;
      const duplicates = this.findDuplicates(arr, threshold);
      filteredNumbers.push({ key, numbers: duplicates });
    }
    return filteredNumbers;
  }

  /**
   * Generates candidate numbers using the first‑order synergy map.
   * If no candidates exist, falls back to scanning historical data.
   */
  private generateNextNumberCandidates(selectedNumber: string, positionIndex: number): string[] {
    const synergyCandidates = this.getSynergyCandidates(positionIndex, selectedNumber);
    if (synergyCandidates.length === 0) {
      const candidates: string[] = [];
      const whiteBallDraws = this.historicalData.map(row => row.slice(0, 5));
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
   * Retrieves candidate numbers from the first‑order synergy map.
   */
  private getSynergyCandidates(positionIndex: number, currentNumber: string): string[] {
    const candidates: string[] = [];
    if (!this.synergyMap[positionIndex] || !this.synergyMap[positionIndex][currentNumber]) {
      return candidates;
    }
    const synergyObject = this.synergyMap[positionIndex][currentNumber];
    for (const [nextNum, count] of Object.entries(synergyObject)) {
      for (let i = 0; i < count; i++) {
        candidates.push(nextNum);
      }
    }
    return candidates;
  }

  /**
   * Builds the higher‑order synergy map by iterating through historical draws.
   * For every pair of consecutive white balls (e.g., "12-25"), records the frequency of the following number.
   */
  private buildHigherOrderSynergyMap(): void {
    this.higherOrderSynergyMap = {};
    for (const row of this.historicalData) {
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
   * Picks the next white-ball number based on the last two white balls using the higher‑order synergy map.
   * Falls back to a random valid number if no candidate is found.
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
    const whiteBallRange = this.config.whiteBallRange!;
    return this.randomNumberInRange(whiteBallRange.min, whiteBallRange.max);
  }

  // ------------- Utility Methods -------------

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

  private pickWeightedRandomFirstNumber(isPowerball: boolean = false): string {
    const index = isPowerball ? 5 : 0;
    const numbers = this.historicalData.map(row => row[index]);
    const frequencyMap = this.createFrequencyMap(numbers);
    const weighted = this.buildWeightedArrayFromMap(frequencyMap);
    if (weighted.length === 0) {
      return numbers[Math.floor(Math.random() * numbers.length)] || '01';
    }
    return weighted[Math.floor(Math.random() * weighted.length)];
  }

  private findDuplicates(array: number[], occurrence: number): number[] {
    const counts = array.reduce((acc, num) => {
      acc[num] = (acc[num] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    return Object.keys(counts)
      .filter(key => counts[+key] >= occurrence)
      .map(Number);
  }
}
