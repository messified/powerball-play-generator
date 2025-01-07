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
   * We will store synergy data for each of the first 5 positions.
   * synergyMap[positionIndex][currentNumber][nextNumber] = how often `nextNumber` follows `currentNumber`
   */
  private synergyMap: {
    [positionIndex: number]: {
      [currentNum: string]: { [nextNum: string]: number };
    };
  } = {};

  constructor() {}

  /**
   * Http request to pull latest data
   */
  // async fetchPowerballResults() {
  //   try {
  //     const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
  //     const url = 'https://data.ny.gov/resource/d6yy-54nr.json';
  //     const data = await this.httpClient.get(url, { headers }).toPromise();

  //     this.powerballData = localStorage.getItem('powerball_data')
  //       ? JSON.parse(localStorage.getItem('powerball_data') as string)
  //       : null;

  //     if (!this.powerballData) {
  //       localStorage.setItem('powerball_data', JSON.stringify(data));
  //     }

  //     return await this.generatePowerballPlay(data);
  //   } catch (e) {
  //     console.error(e);
  //   }
  // }

  async generatePowerballPlay() {
    // 1. Load historical data (here we directly use PowerballData)
    this.powerballData = PowerballData;

    // 2. Filter draws based on fromDate
    const filtered = this.powerballData.filter(
      (el: { draw_date: string | number | Date }) => {
        const drawDate = new Date(el.draw_date);
        return drawDate >= this.fromDate;
      }
    );

    // 3. Format the data for internal usage
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

    // 4. Parse winning numbers (this populates this.historicalData and synergyMap)
    const parsedsets = await this.parseWinningNumbers(formattedData);

    // 5. Filter the parsed sets for duplicates, top frequencies, etc.
    const filteredParsedSets = await this.filterParsedNumberSets(parsedsets);

    // 6. Use recency-based synergy picks for a “highest probability” set
    const highestProbabilityPlay = filteredParsedSets.map((set) => {
      const numbers = set.numbers;
      const strNums: string[] = [];

      numbers.forEach((num: any) => {
        // zero-pad single-digit numbers
        const strN = num.length === 1 ? `0${num.toString()}` : num.toString();
        strNums.push(strN);
      });

      // Weighted pick with recency
      return this.pickAdvancedProbabilityNumberWithRecency(strNums, 50);
    });

    // 7. Build an initial random-based play
    const initialPlay = filteredParsedSets.map((set) => {
      const numbers = set.numbers;
      const randomNumber = numbers[Math.floor(Math.random() * numbers.length)];
      return typeof randomNumber === 'number'
        ? randomNumber.toString()
        : randomNumber;
    });

    /**
     * Fist Predicted Number
     */
    const firstFreqPredictedNumber = this.pickMostFrequentFirstNumber();
    const firstPredictedNumber = this.pickWeightedRandomFirstNumber();

    // 8. Build two different “plays” by ensuring the first number is set
    const predictiveFreqPredictedPlay = this.buildWithTheFirst(
      firstFreqPredictedNumber,
      initialPlay
    );
    const predictiveWeightedRandomPlay = this.buildWithTheFirst(
      firstPredictedNumber,
      initialPlay
    );

    console.log(
      JSON.stringify({
        initialPlay,
        predictiveFreqPredictedPlay,
        predictiveWeightedRandomPlay,
        highestProbabilityPlay,
      })
    );

    // Final return
    return predictiveFreqPredictedPlay;
  }

  private buildWithTheFirst(
    firstPredictedNumber: string,
    initialPlay: any
  ): string[] {
    // Start by predicting the first number
    const firstNumber = firstPredictedNumber;

    // Helper function to handle generation of the next number
    const generateAndPickNextNumber = (
      predictedNumber: string,
      index: number
    ): string => {
      // Build synergy-based “best guess” set
      const synergyBasedNext = this.generateNextNumberArray(predictedNumber, index);
      // Ensure we remove duplicates, then apply advanced weighting
      const bestGuessSet = _.uniq(this.removeDuplicateStrings(synergyBasedNext));

      return this.pickAdvancedProbabilityNumber(bestGuessSet);
    };

    // Predict the second, third, fourth, and fifth numbers
    const secondNumber = generateAndPickNextNumber(firstNumber, 0);
    const thirdNumber = generateAndPickNextNumber(secondNumber, 1);
    const forthNumber = generateAndPickNextNumber(thirdNumber, 2);
    const fifthNumber = generateAndPickNextNumber(forthNumber, 3);

    // Predict the powerball or similar value (positions[5])
    const pbFreqPredict = this.pickMostFrequentFirstNumber(true);
    console.log('pbFreqPredict: ', pbFreqPredict);

    const pbWeightedPredict = this.pickWeightedRandomFirstNumber(true);
    console.log('pbWeightedPredict: ', pbWeightedPredict);

    // Return final result (using the weighted pick for the last number)
    const finalPick = [
      firstNumber,
      secondNumber,
      thirdNumber,
      forthNumber,
      fifthNumber,
      pbWeightedPredict,
    ];

    // Optional: Make sure the 6th (powerball) number is within 1..26
    const enforcedRange = finalPick.map((val, idx) => {
      if (idx === 5) {
        // PB range enforcement
        const numeric = parseInt(val, 10);
        if (numeric < 1 || numeric > 26) {
          return this.fallbackPowerballValue(numeric);
        }
      } else {
        // White ball range enforcement (1..69)
        const numeric = parseInt(val, 10);
        if (numeric < 1 || numeric > 69) {
          return this.fallbackWhiteBallValue(numeric);
        }
      }
      return val;
    });

    return enforcedRange;
  }

  /**
   * Example fallback if out-of-range
   */
  private fallbackPowerballValue(num: number): string {
    // Could do something more advanced,
    // for now, just clamp the value to the [1..26] range
    if (num < 1) return '01';
    if (num > 26) return '26';
    return num.toString().padStart(2, '0');
  }

  /**
   * Example fallback if out-of-range
   */
  private fallbackWhiteBallValue(num: number): string {
    // Just clamp to [1..69]
    if (num < 1) return '01';
    if (num > 69) return '69';
    return num.toString().padStart(2, '0');
  }

  private pickRandomIndexInArray(array: string[]): string {
    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
  }

  private pickHighestProbabilityNumber(bestGuessSet: string[]): string {
    // Step 1: Create a frequency map for numbers in bestGuessSet
    const frequencyMap = this.createFrequencyMap(bestGuessSet);

    // Step 2: Count occurrences of each number in the historical data
    this.historicalData.forEach((row) => {
      row.forEach((number) => {
        if (bestGuessSet.includes(number)) {
          frequencyMap[number] += 1;
        }
      });
    });

    // Step 3: Find the number with the highest frequency
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
    // Optional exponential base for recency weighting
    const RECENCY_EXP_BASE = 1.03; // tweak as needed

    // Step 1: Create a frequency map for numbers in bestGuessSet
    const frequencyMap = this.createFrequencyMap(bestGuessSet);

    // Step 2: Count occurrences of each number in historical data with exponential recency weighting
    this.historicalData.forEach((row, index) => {
      const reverseIndex = this.historicalData.length - 1 - index; // 0 => oldest, so invert
      row.forEach((number) => {
        if (bestGuessSet.includes(number)) {
          // Exponential weighting
          const exponent = Math.pow(RECENCY_EXP_BASE, reverseIndex);
          frequencyMap[number] += exponent;
        }
      });
    });

    // Step 3: Build a weighted array
    const weightedArray = this.buildWeightedArrayFromMap(frequencyMap);

    // Step 4: Pick random from the weighted array
    return this.pickRandomFromWeightedArray(weightedArray, bestGuessSet);
  }

  private async parseWinningNumbers(results: any[]) {
    const plays = results.map((set: { numbers: any }) => set.numbers);
    this.historicalData = _.clone(plays);

    // Initialize synergyMap for positions 0..4
    for (let i = 0; i < 5; i++) {
      this.synergyMap[i] = {};
    }

    // Build synergy data:
    // synergyMap[i][currentNum][nextNum]++
    for (const row of plays) {
      // Only track synergy in the first 5 positions (since 6th is PB)
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

      completeSets.push(
        Object.assign(
          {},
          {
            twoThree: [set.second, set.third],
            fourthFifth: [set.fourth, set.fifth],
          }
        )
      );
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
            result = this.findDuplicates(parsedNumberSets[key], 3);
            break;
          case 'first':
            result = this.findDuplicates(
              this.filterNumbersByRange(parsedNumberSets[key], 4),
              3
            );
            break;
          case 'second':
            result = this.findDuplicates(
              this.filterNumbersByRange(parsedNumberSets[key], 3),
              3
            );
            break;
          case 'third':
            result = this.findDuplicates(
              this.filterNumbersByRange(parsedNumberSets[key], 3),
              3
            );
            break;
          case 'fourth':
            result = this.findDuplicates(
              this.filterNumbersByRange(parsedNumberSets[key], 3),
              3
            );
            break;
          case 'fifth':
            result = this.findDuplicates(
              this.filterNumbersByRange(parsedNumberSets[key], 3),
              3
            );
            break;
        }
        filteredNumbers.push({ key, numbers: result });
      }
    }

    return filteredNumbers;
  }

  private generateNextNumberArray(
    selectedNumber: string,
    customIndex: number = 0
  ): string[] {
    return this.findNextNumbers(
      this.historicalData,
      selectedNumber,
      customIndex
    );
  }

  private removeDuplicateStrings(arr: string[]): string[] {
    return [...new Set(arr)];
  }

  // Uses synergyMap if possible, fallback to simple “stripSixthElement” approach
  private findNextNumbers(
    data: string[][],
    selectedNumber: string,
    customIndex: number = 0
  ): string[] {
    // First, gather synergy-based picks if they exist
    const synergyResults = this.getSynergyBasedNextNumbers(
      customIndex,
      selectedNumber
    );

    // If synergy is empty, fallback to direct scanning
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
    // If synergy data is available for positionIndex, attempt to get next numbers
    if (!this.synergyMap[positionIndex][currentNum]) {
      return [];
    }
    const synergyObject = this.synergyMap[positionIndex][currentNum];
    // synergyObject might look like { "06": 3, "12": 1 } meaning "06" followed "currentNum" 3 times, "12" 1 time, etc.
    // We'll build a weighted array from that synergy object
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
    const fromSet = set.filter((number) => number >= from);
    if (to) {
      return fromSet.filter((number) => number <= to);
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

    // Fallback
    if (!weightedArray.length) {
      return firstNumbers[Math.floor(Math.random() * firstNumbers.length)] || '01';
    }

    const randomIndex = Math.floor(Math.random() * weightedArray.length);
    return weightedArray[randomIndex];
  }

  private pickAdvancedProbabilityNumberWithRecency(
    bestGuessSet: string[],
    recencyThreshold: number
  ): string {
    const RECENCY_EXP_BASE = 1.03; // tweak as needed
    // 1. Slice data for recency
    const recentData = this.historicalData.slice(-recencyThreshold);

    // 2. Create a frequency map
    const frequencyMap = this.createFrequencyMap(bestGuessSet);

    // 3. Count occurrences with exponential recency weighting
    recentData.forEach((row, index) => {
      const reverseIndex = recentData.length - 1 - index;
      row.forEach((number) => {
        if (bestGuessSet.includes(number)) {
          const exponent = Math.pow(RECENCY_EXP_BASE, reverseIndex);
          frequencyMap[number] += exponent;
        }
      });
    });

    // 4. Build weighted array
    const weightedArray = this.buildWeightedArrayFromMap(frequencyMap);

    // 5. Pick random
    return this.pickRandomFromWeightedArray(weightedArray, bestGuessSet);
  }

  /**
   * -----------------------
   * SHARED HELPER METHODS
   * -----------------------
   */
  private createFrequencyMap(array: string[]): { [key: string]: number } {
    const frequencyMap: { [key: string]: number } = {};
    array.forEach((value) => {
      // Initialize to 0 to avoid NaN
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
      // fallback
      return fallbackSet[Math.floor(Math.random() * fallbackSet.length)] || '01';
    }
    const randomIndex = Math.floor(Math.random() * weightedArray.length);
    return weightedArray[randomIndex];
  }
}
