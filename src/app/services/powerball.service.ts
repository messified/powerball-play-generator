import { Injectable } from '@angular/core';
import { PowerballData } from './powerball-data';
import _ from 'lodash';

export interface IWinningsResponse {
  draw_date: string;
  winning_numbers: string;
  multiplier: string;
}

export interface IParsedWinningsResponse {
  date: string;
  numbers: any[];
  multiplier: string;
}

@Injectable()
export class PowerballService {
  private fromDate: Date = new Date('2019-01-04T00:00:00');
  private powerballData: any;
  private historicalData: string[][] = [];

  /**
   * synergyMap[positionIndex][currentNumber][nextNumber] = frequency
   */
  private synergyMap: {
    [positionIndex: number]: {
      [currentNum: string]: { [nextNum: string]: number };
    };
  } = {};

  constructor() {}

  // ------------------------------------------------------------
  // MAIN ENTRY
  // ------------------------------------------------------------

  async generatePowerballPlay() {
    // 1. Load historical data
    this.powerballData = PowerballData;

    // 2. Filter based on fromDate
    const filtered = this.powerballData.filter(
      (el: { draw_date: string | number | Date }) => {
        const drawDate = new Date(el.draw_date);
        return drawDate >= this.fromDate;
      }
    );

    // 3. Map the filtered data
    const formattedData = filtered.map(
      (result: {
        draw_date: any;
        winning_numbers: string;
        multiplier: any;
      }) => ({
        date: result.draw_date,
        numbers: result.winning_numbers.split(' '),
        multiplier: result.multiplier,
      })
    );

    // 4. Parse winning numbers
    const parsedsets = await this.parseWinningNumbers(formattedData);

    // 5. Filter duplicates/frequencies
    const filteredParsedSets = await this.filterParsedNumberSets(parsedsets);

    // 6. Highest Probability
    const highestProbabilityPlay = filteredParsedSets.map((set) => {
      const numbers = set.numbers;
      const strNums: string[] = [];

      numbers.forEach((num: any) => {
        const strN = num.length === 1 ? `0${num}` : num.toString();
        strNums.push(strN);
      });

      // Weighted pick with recency
      return this.pickAdvancedProbabilityNumberWithRecency(strNums, 50);
    });

    // 7. Initial Random
    const initialPlay = filteredParsedSets.map((set) => {
      const numbers = set.numbers;
      const randomNumber = numbers[Math.floor(Math.random() * numbers.length)];
      return typeof randomNumber === 'number'
        ? randomNumber.toString()
        : randomNumber;
    });

    // 8. Two different seeded plays
    const firstFreqPredictedNumber = this.pickMostFrequentFirstNumber();
    const firstPredictedNumber = this.pickWeightedRandomFirstNumber();

    const predictiveFreqPredictedPlay = this.buildWithTheFirst(
      firstFreqPredictedNumber,
      initialPlay
    );
    const predictiveWeightedRandomPlay = this.buildWithTheFirst(
      firstPredictedNumber,
      initialPlay
    );

    /**
     * 9. AI Predictive Set
     *    This merges synergy-based logic with advanced recency weighting,
     *    plus fallback logic and a mild random offset to avoid repetitive "01" sets.
     */
    const aiPredictiveSet = filteredParsedSets.map((set) => {
      // We'll generate 6 numbers (index 0..5)
      // If set.numbers is empty or invalid, fallback to random picks
      if (!set.numbers || !set.numbers.length) {
        return this.generateFallbackSet();
      }

      const synergyBasedPick: string[] = [];
      // Start with a random seed from the set
      let currentPick = set.numbers[
        Math.floor(Math.random() * set.numbers.length)
      ].toString();

      // We'll fill first 5 positions using synergy + recency weighting
      for (let i = 0; i < 5; i++) {
        // synergy approach
        const synergyCandidates = this.generateNextNumberArray(currentPick, i);

        // fallback if synergy is empty
        if (!synergyCandidates || !synergyCandidates.length) {
          // fallback to random from 1..69
          const fallback = this.randomNumberInRange(1, 69);
          synergyBasedPick.push(fallback);
          currentPick = fallback;
          continue;
        }

        const uniqueCandidates = _.uniq(
          this.removeDuplicateStrings(synergyCandidates)
        );

        // use advanced recency weighting
        let chosen = this.pickAdvancedProbabilityNumber(uniqueCandidates);

        // fallback if chosen is empty
        if (!chosen) {
          chosen = this.randomNumberInRange(1, 69);
        }

        // mild random offset chance (e.g. 15% chance we pick random out-of-band)
        if (Math.random() < 0.15) {
          const randomAlt = this.randomNumberInRange(1, 69);
          chosen = randomAlt;
        }

        synergyBasedPick.push(chosen);
        currentPick = chosen;
      }

      // Choose powerball with synergy or random
      const chosenPB = this.pickPowerballAi();

      // Enforce PB range
      const numericPB = parseInt(chosenPB, 10);
      const validPB =
        numericPB < 1 || numericPB > 26
          ? this.fallbackPowerballValue(numericPB)
          : chosenPB;

      return [...synergyBasedPick, validPB];
    });

    // 10. Sort the first five numbers in each set
    const sortedInitialPlay = this.sortGeneratedSet(initialPlay);
    const sortedPredictiveFreqPredictedPlay = this.sortGeneratedSet(
      predictiveFreqPredictedPlay
    );
    const sortedPredictiveWeightedRandomPlay = this.sortGeneratedSet(
      predictiveWeightedRandomPlay
    );
    const sortedHighestProbabilityPlay = this.sortGeneratedSet(
      highestProbabilityPlay
    );
    // Sort the new AI set
    const sortedAiPredictiveSet = this.sortGeneratedSet(aiPredictiveSet);

    // 11. Log resulting sets, now including aiPredictiveSet
    console.log(
      JSON.stringify({
        initialPlay: sortedInitialPlay,
        predictiveFreqPredictedPlay: sortedPredictiveFreqPredictedPlay,
        predictiveWeightedRandomPlay: sortedPredictiveWeightedRandomPlay,
        highestProbabilityPlay: sortedHighestProbabilityPlay,
        aiPredictiveSet: sortedAiPredictiveSet,
      })
    );

    // Return whichever set you want. Here we return the new AI set
    return sortedPredictiveWeightedRandomPlay;
  }

  // ------------------------------------------------------------
  // AI HELPER METHODS
  // ------------------------------------------------------------

  /**
   * Picks a powerball with synergy + random fallback.
   */
  private pickPowerballAi(): string {
    // Attempt synergy approach (using historical PBs)
    const possiblePBs = this.historicalData.map((row) => row[5]);
    if (possiblePBs && possiblePBs.length) {
      const freqMap = this.createFrequencyMap(possiblePBs);
      const weightedPBs = this.buildWeightedArrayFromMap(freqMap);
      // fallback if no weighting
      if (!weightedPBs.length) {
        return this.randomNumberInRange(1, 26);
      }
      return weightedPBs[Math.floor(Math.random() * weightedPBs.length)] || '01';
    }
    // fallback if no PB data
    return this.randomNumberInRange(1, 26);
  }

  /**
   * Generates a random fallback set of length 6 (1..69 for first five, 1..26 for PB).
   * This is used if synergy fails or there's no data in the set.
   */
  private generateFallbackSet(): string[] {
    const fallback = [];
    for (let i = 0; i < 5; i++) {
      fallback.push(this.randomNumberInRange(1, 69));
    }
    fallback.push(this.randomNumberInRange(1, 26));
    return fallback;
  }

  /**
   * Returns a random integer (as a string) between [min..max], zero-padded if needed.
   */
  private randomNumberInRange(min: number, max: number): string {
    const rand = Math.floor(Math.random() * (max - min + 1)) + min;
    return rand.toString().padStart(2, '0');
  }

  // ------------------------------------------------------------
  // BUILD + SORT HELPERS
  // ------------------------------------------------------------

  private buildWithTheFirst(
    firstPredictedNumber: string,
    initialPlay: any
  ): string[] {
    const firstNumber = firstPredictedNumber;

    const generateAndPickNextNumber = (
      predictedNumber: string,
      index: number
    ): string => {
      const synergyBasedNext = this.generateNextNumberArray(
        predictedNumber,
        index
      );
      const bestGuessSet = _.uniq(this.removeDuplicateStrings(synergyBasedNext));

      // If synergy is empty, fallback
      if (!bestGuessSet || !bestGuessSet.length) {
        return this.randomNumberInRange(1, 69);
      }
      const picked = this.pickAdvancedProbabilityNumber(bestGuessSet);
      // fallback if none picked
      if (!picked) {
        return this.randomNumberInRange(1, 69);
      }
      return picked;
    };

    const secondNumber = generateAndPickNextNumber(firstNumber, 0);
    const thirdNumber = generateAndPickNextNumber(secondNumber, 1);
    const forthNumber = generateAndPickNextNumber(thirdNumber, 2);
    const fifthNumber = generateAndPickNextNumber(forthNumber, 3);

    const pbWeightedPredict = this.pickWeightedRandomFirstNumber(true);

    const finalPick = [
      firstNumber,
      secondNumber,
      thirdNumber,
      forthNumber,
      fifthNumber,
      pbWeightedPredict,
    ];

    // Range enforcement
    const enforcedRange = finalPick.map((val, idx) => {
      if (idx === 5) {
        const numeric = parseInt(val, 10);
        if (numeric < 1 || numeric > 26) {
          return this.fallbackPowerballValue(numeric);
        }
      } else {
        const numeric = parseInt(val, 10);
        if (numeric < 1 || numeric > 69) {
          return this.fallbackWhiteBallValue(numeric);
        }
      }
      return val;
    });

    return enforcedRange;
  }

  private sortGeneratedSet(generated: any): any {
    if (Array.isArray(generated) && Array.isArray(generated[0])) {
      // Array of arrays
      return generated.map((g) => this.sortSingleSet(g));
    }
    if (Array.isArray(generated) && generated.length === 6) {
      // Single set
      return this.sortSingleSet(generated);
    }
    if (Array.isArray(generated)) {
      // Possibly an array of strings or nested arrays
      return generated.map((item) => {
        if (Array.isArray(item) && item.length === 6) {
          return this.sortSingleSet(item);
        }
        return item;
      });
    }
    return generated; // Fallback
  }

  private sortSingleSet(setOfSix: string[]): string[] {
    if (!setOfSix || setOfSix.length !== 6) {
      return setOfSix;
    }
    const firstFive = setOfSix.slice(0, 5).map((val) => parseInt(val, 10));
    firstFive.sort((a, b) => a - b);
    const sortedStrings = firstFive.map((num) => num.toString().padStart(2, '0'));
    return [...sortedStrings, setOfSix[5]];
  }

  // ------------------------------------------------------------
  // CLAMPING / FALLBACKS
  // ------------------------------------------------------------
  private fallbackPowerballValue(num: number): string {
    if (num < 1) return '01';
    if (num > 26) return '26';
    return num.toString().padStart(2, '0');
  }

  private fallbackWhiteBallValue(num: number): string {
    if (num < 1) return '01';
    if (num > 69) return '69';
    return num.toString().padStart(2, '0');
  }

  private pickRandomIndexInArray(array: string[]): string {
    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
  }

  // ------------------------------------------------------------
  // PROBABILITY PICKS
  // ------------------------------------------------------------

  private pickHighestProbabilityNumber(bestGuessSet: string[]): string {
    const frequencyMap = this.createFrequencyMap(bestGuessSet);

    this.historicalData.forEach((row) => {
      row.forEach((number) => {
        if (bestGuessSet.includes(number)) {
          frequencyMap[number] += 1;
        }
      });
    });

    let highestProbabilityNumber = bestGuessSet[0];
    let maxFrequency = frequencyMap[highestProbabilityNumber] || 0;

    for (const number of bestGuessSet) {
      if (frequencyMap[number] > maxFrequency) {
        highestProbabilityNumber = number;
        maxFrequency = frequencyMap[number];
      }
    }
    return highestProbabilityNumber;
  }

  private pickAdvancedProbabilityNumber(bestGuessSet: string[]): string {
    const RECENCY_EXP_BASE = 1.03;
    const frequencyMap = this.createFrequencyMap(bestGuessSet);

    this.historicalData.forEach((row, index) => {
      const reverseIndex = this.historicalData.length - 1 - index;
      row.forEach((number) => {
        if (bestGuessSet.includes(number)) {
          const exponent = Math.pow(RECENCY_EXP_BASE, reverseIndex);
          frequencyMap[number] += exponent;
        }
      });
    });

    const weightedArray = this.buildWeightedArrayFromMap(frequencyMap);
    return this.pickRandomFromWeightedArray(weightedArray, bestGuessSet);
  }

  // Exposes synergy + recency for the last 'recencyThreshold' draws
  private pickAdvancedProbabilityNumberWithRecency(
    bestGuessSet: string[],
    recencyThreshold: number
  ): string {
    const RECENCY_EXP_BASE = 1.03;
    const recentData = this.historicalData.slice(-recencyThreshold);
    const frequencyMap = this.createFrequencyMap(bestGuessSet);

    recentData.forEach((row, index) => {
      const reverseIndex = recentData.length - 1 - index;
      row.forEach((number) => {
        if (bestGuessSet.includes(number)) {
          const exponent = Math.pow(RECENCY_EXP_BASE, reverseIndex);
          frequencyMap[number] += exponent;
        }
      });
    });

    const weightedArray = this.buildWeightedArrayFromMap(frequencyMap);
    return this.pickRandomFromWeightedArray(weightedArray, bestGuessSet);
  }

  // ------------------------------------------------------------
  // DATA PARSING + FILTERS
  // ------------------------------------------------------------

  private async parseWinningNumbers(results: any[]) {
    const plays = results.map((set: { numbers: any }) => set.numbers);
    this.historicalData = _.clone(plays);

    // Initialize synergy
    for (let i = 0; i < 5; i++) {
      this.synergyMap[i] = {};
    }

    // Build synergy data
    for (const row of plays) {
      for (let i = 0; i < 4; i++) {
        const current = row[i];
        const next = row[i + 1];
        if (!this.synergyMap[i][current]) {
          this.synergyMap[i][current] = {};
        }
        if (!this.synergyMap[i][current][next]) {
          this.synergyMap[i][current][next] = 0;
        }
        this.synergyMap[i][current][next]++;
      }
    }

    return plays.map((set: any[]) =>
      Object.assign({}, {
        first: set[0],
        second: set[1],
        third: set[2],
        fourth: set[3],
        fifth: set[4],
        powerball: set[5],
      })
    );
  }

  private async filterParsedNumberSets(numberSets: any = []) {
    const firsts: number[] = [];
    const seconds: number[] = [];
    const thirds: number[] = [];
    const fourths: number[] = [];
    const fifths: number[] = [];
    const powerballs: number[] = [];

    const completeSets = [];

    numberSets.forEach((set: any) => {
      firsts.push(parseInt(set.first, 10));
      seconds.push(parseInt(set.second, 10));
      thirds.push(parseInt(set.third, 10));
      fourths.push(parseInt(set.fourth, 10));
      fifths.push(parseInt(set.fifth, 10));
      powerballs.push(parseInt(set.powerball, 10));

      completeSets.push({
        twoThree: [set.second, set.third],
        fourthFifth: [set.fourth, set.fifth],
      });
    });

    const parsedNumberSets = {
      first: firsts,
      second: seconds,
      third: thirds,
      fourth: fourths,
      fifth: fifths,
      powerball: powerballs,
    };

    const filteredNumbers: { key: string; numbers: number[] }[] = [];

    for (const key in parsedNumberSets) {
      if (parsedNumberSets.hasOwnProperty(key)) {
        let result: number[] = [];
        switch (key) {
          case 'powerball':
            result = this.findDuplicates(parsedNumberSets[key], 2);
            break;
          case 'first':
            result = this.findDuplicates(
              this.filterNumbersByRange(parsedNumberSets[key], 2),
              3
            );
            break;
          case 'second':
            result = this.findDuplicates(
              this.filterNumbersByRange(parsedNumberSets[key], 2),
              3
            );
            break;
          case 'third':
            result = this.findDuplicates(
              this.filterNumbersByRange(parsedNumberSets[key], 2),
              3
            );
            break;
          case 'fourth':
            result = this.findDuplicates(
              this.filterNumbersByRange(parsedNumberSets[key], 2),
              3
            );
            break;
          case 'fifth':
            result = this.findDuplicates(
              this.filterNumbersByRange(parsedNumberSets[key], 2),
              3
            );
            break;
        }
        filteredNumbers.push({ key, numbers: result });
      }
    }

    return filteredNumbers;
  }

  // ------------------------------------------------------------
  // SYNERGY-BASED + SCANNING
  // ------------------------------------------------------------

  private generateNextNumberArray(
    selectedNumber: string,
    customIndex: number = 0
  ): string[] {
    return this.findNextNumbers(this.historicalData, selectedNumber, customIndex);
  }

  private removeDuplicateStrings(arr: string[]): string[] {
    return [...new Set(arr)];
  }

  private findNextNumbers(
    data: string[][],
    selectedNumber: string,
    customIndex: number = 0
  ): string[] {
    const synergyResults = this.getSynergyBasedNextNumbers(
      customIndex,
      selectedNumber
    );

    if (!synergyResults.length) {
      const nextNumbers: string[] = [];
      const strippedData = this.stripSixthElement(data);
      for (const subArray of strippedData) {
        if (customIndex < 0 || customIndex > 4) continue;
        if (subArray[customIndex] === selectedNumber) {
          if (customIndex < subArray.length - 1) {
            nextNumbers.push(subArray[customIndex + 1]);
          }
        }
      }
      return nextNumbers;
    }
    return synergyResults;
  }

  private getSynergyBasedNextNumbers(positionIndex: number, currentNum: string) {
    if (!this.synergyMap[positionIndex][currentNum]) {
      return [];
    }
    const synergyObject = this.synergyMap[positionIndex][currentNum];
    const synergyWeightedArray: string[] = [];
    for (const nextNum in synergyObject) {
      const count = synergyObject[nextNum];
      for (let i = 0; i < count; i++) {
        synergyWeightedArray.push(nextNum);
      }
    }
    return synergyWeightedArray;
  }

  private stripSixthElement(data: string[][]): string[][] {
    return data.map((subArray) => subArray.slice(0, 5));
  }

  // ------------------------------------------------------------
  // RECENT DRAWS, RANGE, DUPLICATES
  // ------------------------------------------------------------

  async getRecentDrawings(count: number) {
    const recentDraws = [];
    for (let i = 0; i < count; i++) {
      recentDraws.push(this.powerballData[i]);
    }
    return recentDraws.map((result) => ({
      date: result.draw_date,
      numbers: result.winning_numbers.split(' '),
      multiplier: result.multiplier,
    }));
  }

  private filterNumbersByRange(
    set: number[],
    from: number,
    to: number | null = null
  ): number[] {
    const fromSet = set.filter((num) => num >= from);
    if (to) {
      return fromSet.filter((num) => num <= to);
    }
    return fromSet;
  }

  private findDuplicates(array: number[], occurrence: number): number[] {
    const counts = array.reduce((acc, num) => {
      acc[num] = (acc[num] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return Object.keys(counts)
      .filter((key) => counts[Number(key)] >= occurrence)
      .map(Number);
  }

  // ------------------------------------------------------------
  // FIRST NUMBER PICKS
  // ------------------------------------------------------------

  private pickMostFrequentFirstNumber(powerball: boolean = false) {
    const index = powerball ? 5 : 0;
    const firstNumbers = this.historicalData.map((subArray) => subArray[index]);
    const frequencyMap = this.createFrequencyMap(firstNumbers);

    let mostFrequentNumber = firstNumbers[0] || '01';
    let maxCount = 0;

    for (const number in frequencyMap) {
      if (frequencyMap[number] > maxCount) {
        maxCount = frequencyMap[number];
        mostFrequentNumber = number;
      }
    }
    return mostFrequentNumber;
  }

  private pickWeightedRandomFirstNumber(powerball: boolean = false) {
    const index = powerball ? 5 : 0;
    const firstNumbers = this.historicalData.map((subArray) => subArray[index]);
    const frequencyMap = this.createFrequencyMap(firstNumbers);

    const weightedArray = this.buildWeightedArrayFromMap(frequencyMap);
    if (!weightedArray.length) {
      return firstNumbers[Math.floor(Math.random() * firstNumbers.length)] || '01';
    }
    const randomIndex = Math.floor(Math.random() * weightedArray.length);
    return weightedArray[randomIndex];
  }

  // ------------------------------------------------------------
  // FREQUENCY MAP + WEIGHTED ARRAY
  // ------------------------------------------------------------

  private createFrequencyMap(array: string[]): { [key: string]: number } {
    const frequencyMap: { [key: string]: number } = {};
    array.forEach((value) => {
      if (!frequencyMap[value]) {
        frequencyMap[value] = 0;
      }
    });
    return frequencyMap;
  }

  private buildWeightedArrayFromMap(
    frequencyMap: { [key: string]: number }
  ): string[] {
    const weightedArray: string[] = [];
    for (const number in frequencyMap) {
      const weight = Math.floor(frequencyMap[number]);
      for (let i = 0; i < weight; i++) {
        weightedArray.push(number);
      }
    }
    return weightedArray;
  }

  private pickRandomFromWeightedArray(
    weightedArray: string[],
    fallbackSet: string[]
  ): string {
    if (!weightedArray.length) {
      return fallbackSet[Math.floor(Math.random() * fallbackSet.length)] || '01';
    }
    const randomIndex = Math.floor(Math.random() * weightedArray.length);
    return weightedArray[randomIndex];
  }
}
