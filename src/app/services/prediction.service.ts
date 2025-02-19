import { Injectable } from '@angular/core';
import { PowerballData } from '../data/powerball-data';
import _ from 'lodash';

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

interface PredictionConfig {
  whiteBallRange: { min: number; max: number };
  powerballRange: { min: number; max: number };
  whiteBallDupThreshold: number;
  powerballDupThreshold: number;
  recencyExpBase: number;
}

@Injectable({
  providedIn: 'root',
})
export class PredictionService {
  private powerballData: any[] = [];
  private historicalData: string[][] = [];

  /**
   * The synergyMap holds, for each white ball position (0-4),
   * the frequency with which a number is followed by another.
   *
   * E.g. synergyMap[0][selectedNumber] = { nextNum1: frequency, nextNum2: frequency, ... }
   */
  private synergyMap: {
    [positionIndex: number]: { [currentNum: string]: { [nextNum: string]: number } };
  } = {};

  // Configurable parameters that you can tweak:
  private config: PredictionConfig = {
    whiteBallRange: { min: 1, max: 69 },
    powerballRange: { min: 1, max: 26 },
    whiteBallDupThreshold: 5,  // Minimum occurrences to consider a white ball candidate
    powerballDupThreshold: 9,  // Minimum occurrences to consider a powerball candidate
    recencyExpBase: 1.055,     // Recency exponent base for weighting recent draws
  };

  constructor() {}

  /**
   * Main entry point.
   * 1. Loads and parses historical data.
   * 2. Builds a synergy map.
   * 3. Picks numbers based on a weighted/synergy strategy.
   * 4. Returns the final, formatted set of numbers.
   */
  async generatePowerballPlay(): Promise<string[]> {
    // Load and format historical data
    this.powerballData = PowerballData;
    const formattedData = this.powerballData.map((result: {
      draw_date: any;
      winning_numbers: string;
      multiplier: any;
    }) => ({
      date: result.draw_date,
      numbers: result.winning_numbers.split(' '),
      multiplier: result.multiplier || '01',
    }));

    // Build synergy map and store historical white-ball draws
    const parsedSets = await this.parseWinningNumbers(formattedData);

    // Optionally filter historical positions (this example uses duplicate thresholds)
    const _ = await this.filterParsedNumberSets(parsedSets);

    // Pick first white ball using a weighted random selection based on frequency
    const firstWhiteBall = this.pickWeightedRandomFirstNumber();

    // Build the full play based on synergy
    const predictivePlay = this.buildPlayWithSynergy(firstWhiteBall);

    // Sort white balls and enforce valid ranges
    const finalPick = this.sortAndEnforceRange(predictivePlay);
    return finalPick;
  }

  /**
 * Predicts the next play by:
 * 1. Predicting the next powerball number.
 * 2. Predicting the likely first white ball based on historical draws that share that powerball.
 * 3. Building the remainder of the play using the synergy-based method.
 */
predictPlayBasedOnPredictedPowerball(): string[] {
  const predictedPB = this.predictNextPowerball();
  const likelyFirstWhiteBall = this.predictFirstNumberBasedOnPowerball(predictedPB);
  
  // Build the play starting from the likely first white ball.
  const play = this.buildPlayWithSynergy(likelyFirstWhiteBall);
  
  // Override the powerball with our predicted powerball.
  play[5] = predictedPB;
  
  return this.sortAndEnforceRange(play);
}

/**
 * Predicts the next powerball number based on historical frequency (position 5).
 */
private predictNextPowerball(): string {
  return this.pickWeightedRandomFirstNumber(true);
}

/**
 * Given a predicted powerball number, this function looks at historical draws where the powerball matched,
 * extracts the first white ball from those draws, and returns a weighted random choice from those candidates.
 * If no historical draws share the predicted powerball, it falls back to a standard weighted pick.
 */
private predictFirstNumberBasedOnPowerball(predictedPB: string): string {
  // Filter historical draws where the powerball (index 5) equals the predicted value.
  const matchingDraws = this.historicalData.filter(row => row[5] === predictedPB);
  
  if (matchingDraws.length === 0) {
    // Fallback to overall weighted first number if no matching draws are found.
    return this.pickWeightedRandomFirstNumber();
  }
  
  // Extract the first white ball (index 0) from the matching draws.
  const firstNumbers = matchingDraws.map(row => row[0]);
  const freqMap = this.createFrequencyMap(firstNumbers);
  const weightedCandidates = this.buildWeightedArrayFromMap(freqMap);
  
  return weightedCandidates[Math.floor(Math.random() * weightedCandidates.length)];
}


  /**
   * Build the predicted play:
   * - For white balls, starting with the first, use synergy-based prediction.
   * - For the powerball, use a weighted random selection.
   */
  private buildPlayWithSynergy(firstWhiteBall: string): string[] {
    const whiteBalls: string[] = [firstWhiteBall];

    // For positions 0-3, predict the next number based on synergy from the previous number
    for (let pos = 0; pos < 4; pos++) {
      const previous = whiteBalls[pos];
      const candidateNumbers = this.generateNextNumberCandidates(previous, pos);
      const nextNumber = candidateNumbers.length
        ? this.pickAdvancedProbabilityNumber(candidateNumbers)
        : this.randomNumberInRange(this.config.whiteBallRange.min, this.config.whiteBallRange.max);
      whiteBalls.push(nextNumber);
    }

    // For the powerball, pick using weighted random (position index 5 in our historicalData)
    const powerball = this.pickWeightedRandomFirstNumber(true);

    return [...whiteBalls, powerball];
  }

  /**
   * Sort the white balls (first five) in ascending order and enforce number ranges.
   * The powerball remains in its original (6th) position.
   */
  private sortAndEnforceRange(play: string[]): string[] {
    // Process white balls
    const whiteBalls = play.slice(0, 5).map(num => {
      let n = parseInt(num, 10);
      if (n < this.config.whiteBallRange.min) n = this.config.whiteBallRange.min;
      if (n > this.config.whiteBallRange.max) n = this.config.whiteBallRange.max;
      return n;
    });
    whiteBalls.sort((a, b) => a - b);
    const formattedWhiteBalls = whiteBalls.map(n => n.toString().padStart(2, '0'));

    // Process powerball
    let pb = parseInt(play[5], 10);
    if (pb < this.config.powerballRange.min) pb = this.config.powerballRange.min;
    if (pb > this.config.powerballRange.max) pb = this.config.powerballRange.max;
    const formattedPb = pb.toString().padStart(2, '0');

    return [...formattedWhiteBalls, formattedPb];
  }

  /**
   * Parse the historical data to:
   * 1. Store each draw’s white ball numbers.
   * 2. Build the synergy map for white ball positions.
   */
  private async parseWinningNumbers(results: any[]): Promise<any[]> {
    const plays = results.map(set => set.numbers);
    // Clone plays into historicalData
    this.historicalData = _.cloneDeep(plays);

    // Initialize synergy map for white ball positions (0 to 4)
    for (let i = 0; i < 5; i++) {
      this.synergyMap[i] = {};
    }

    // Build synergy data: for each row, for positions 0-3, note which number follows the current number.
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

    // Return parsed data in a structured format
    return plays.map(set => ({
      numbers: set,
      powerball: set[5],
    }));
  }

  /**
   * Filter the parsed number sets based on duplicate-occurrence thresholds.
   * (This method can be expanded for more complex filtering if needed.)
   */
  private async filterParsedNumberSets(numberSets: any[] = []): Promise<{ key: string; numbers: number[]; }[]> {
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

    const filteredNumbers: { key: string; numbers: number[] }[] = [];
    for (const key of positions) {
      const arr = parsedNumberSets[key].filter(num => {
        if (key === 'powerball') {
          return num >= this.config.powerballRange.min && num <= this.config.powerballRange.max;
        }
        return num >= this.config.whiteBallRange.min && num <= this.config.whiteBallRange.max;
      });
      const threshold = key === 'powerball' ? this.config.powerballDupThreshold : this.config.whiteBallDupThreshold;
      const duplicates = this.findDuplicates(arr, threshold);
      filteredNumbers.push({ key, numbers: duplicates });
    }
    return filteredNumbers;
  }

  /**
   * Generate candidate numbers that could follow the selected number at a given position,
   * using the synergy map. If none exist, fallback to scanning historical data.
   */
  private generateNextNumberCandidates(selectedNumber: string, positionIndex: number): string[] {
    const synergyCandidates = this.getSynergyCandidates(positionIndex, selectedNumber);
    if (synergyCandidates.length === 0) {
      // Fallback: Look through historical data for draws where the selected number appears at the given position.
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
   * Retrieve synergy-based candidates from the synergy map.
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
   * Pick a candidate number using advanced probability that combines frequency
   * with recency weighting.
   */
  private pickAdvancedProbabilityNumber(candidates: string[]): string {
    const frequencyMap: Record<string, number> = this.createFrequencyMap(candidates);

    // Increase weight for candidates appearing in more recent draws
    this.historicalData.forEach((row, idx) => {
      const reverseIndex = this.historicalData.length - 1 - idx;
      row.forEach((num: string) => {
        if (candidates.includes(num)) {
          frequencyMap[num] = (frequencyMap[num] || 0) + Math.pow(this.config.recencyExpBase, reverseIndex);
        }
      });
    });

    const weightedArray = this.buildWeightedArrayFromMap(frequencyMap);
    return this.pickRandomFromWeightedArray(weightedArray, candidates);
  }

  // --------------------- Utility Methods ---------------------

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

  /**
   * Returns a random integer (as a string) between min and max, zero-padded to 2 digits.
   */
  private randomNumberInRange(min: number, max: number): string {
    const rand = Math.floor(Math.random() * (max - min + 1)) + min;
    return rand.toString().padStart(2, '0');
  }

  /**
   * Pick the first number (or powerball if specified) using a weighted random
   * selection based on historical frequency.
   */
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

  /**
   * Find numbers in an array that appear at least the given number of times.
   */
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