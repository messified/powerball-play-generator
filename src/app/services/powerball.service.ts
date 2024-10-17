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

  constructor() {}

  /**
   * Http request to pull latest data
   */
  // async fetchPowerballResults() {
  //   try {
  //     const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
  //     const url = 'https://data.ny.gov/resource/d6yy-54nr.json';
  //     const data = await this.httpClient
  //       .get(url, { headers: headers })
  //       .toPromise();

  //     this.powerballData = localStorage.getItem('powerball_data')
  //       ? JSON.parse(localStorage.getItem('powerball_data'))
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
    this.powerballData = PowerballData;

    const filtered = this.powerballData.filter(
      (el: { draw_date: string | number | Date }): any => {
        const drawDate = new Date(el.draw_date);

        if (drawDate >= this.fromDate) {
          return el;
        }
      }
    );

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

    const parsedsets = await this.parseWinningNumbers(formattedData);
    const filteredParsedSets = await this.filterParsedNumberSets(parsedsets);

    const highestProbabilityPlay = filteredParsedSets.map((set) => {
      const numbers = set.numbers;
      const strNums: string[] = [];
      
      numbers.forEach(num => {
        const strN = num.length === 1 ? `0${num.toString()}` : num.toString();
        strNums.push(strN);
      });

      return this.pickAdvancedProbabilityNumberWithRecency(strNums, 50);
    });

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
    
    const predictiveFreqPredictedPlay = this.buildWithTheFirst(firstFreqPredictedNumber, initialPlay);
    const predictiveWeightedRandomPlay = this.buildWithTheFirst(firstPredictedNumber, initialPlay);

    console.log(JSON.stringify({
      initialPlay,
      predictiveFreqPredictedPlay,
      predictiveWeightedRandomPlay,
      highestProbabilityPlay
    }));

    return predictiveFreqPredictedPlay;
  }

  private buildWithTheFirst(firstPredictedNumber: string, initialPlay: any): string[] {
    // Start by predicting the first number
    const firstNumber = firstPredictedNumber;

    // Helper function to handle the generation of the next number
    const generateAndPickNextNumber = (predictedNumber: string, index: number): string => {
      const bestGuessSet = _.uniq(this.removeDuplicateStrings(this.generateNextNumberArray(predictedNumber, index)));
      return this.pickAdvancedProbabilityNumber(bestGuessSet);
    };

    // Predict the second, third, fourth, and fifth numbers
    const secondNumber = generateAndPickNextNumber(firstNumber, 0);
    const thirdNumber = generateAndPickNextNumber(secondNumber, 1);
    const forthNumber = generateAndPickNextNumber(thirdNumber, 2);
    const fifthNumber = generateAndPickNextNumber(forthNumber, 3);

    // Predict the powerball or similar value
    const pbFreqPredict = this.pickMostFrequentFirstNumber(true);
    console.log('pbFreqPredict: ', pbFreqPredict);
    const pbWeightedPredict = this.pickWeightedRandomFirstNumber(true);
    console.log('pbWeightedPredict: ', pbWeightedPredict);

    // Handle the sixth number (with padding if necessary)
    // const sixthNumber = initialPlay[5].length === 1 ? `0${initialPlay[5]}` : initialPlay[5];

    // Return the final result set
    return [firstNumber, secondNumber, thirdNumber, forthNumber, fifthNumber, pbWeightedPredict];
  }

  private pickRandomIndexInArray(array: string[]): string {
    // Pick a random index between 0 and the length of the array
    const randomIndex = Math.floor(Math.random() * array.length);
  
    // Return the element at the random index
    return array[randomIndex];
  }

  private pickHighestProbabilityNumber(bestGuessSet: string[]): string {
    // Step 1: Create a frequency map for numbers in bestGuessSet
    const frequencyMap: { [key: string]: number } = {};

    // Initialize the frequency map for all numbers in bestGuessSet
    bestGuessSet.forEach(number => {
        frequencyMap[number] = 0;
    });

    // Step 2: Count occurrences of each number in the historical data
    this.historicalData.forEach(row => {
        row.forEach(number => {
            if (bestGuessSet.includes(number)) {
                frequencyMap[number] += 1;
            }
        });
    });

    // Step 3: Find the number with the highest frequency
    let highestProbabilityNumber = bestGuessSet[0];
    let maxFrequency = frequencyMap[highestProbabilityNumber];

    bestGuessSet.forEach(number => {
        if (frequencyMap[number] > maxFrequency) {
            highestProbabilityNumber = number;
            maxFrequency = frequencyMap[number];
        }
    });

    // Step 4: Return the number with the highest probability
    return highestProbabilityNumber;
  }

  private pickAdvancedProbabilityNumber(bestGuessSet: string[]): string {
    // Step 1: Create a frequency map for numbers in bestGuessSet
    const frequencyMap: { [key: string]: number } = {};

    // Initialize frequency map for bestGuessSet numbers
    bestGuessSet.forEach(number => {
        frequencyMap[number] = 0;
    });

    // Step 2: Count occurrences of each number in historical data
    this.historicalData.forEach((row, index) => {
        row.forEach(number => {
            if (bestGuessSet.includes(number)) {
                // Increase count based on recency bias (newer data gets more weight)
                // Recent rows are given a higher multiplier for their frequency
                const recencyWeight = this.historicalData.length - index;
                frequencyMap[number] += recencyWeight;
            }
        });
    });

    // Step 3: Convert frequencies into a weighted probability array
    const weightedArray: string[] = [];
    bestGuessSet.forEach(number => {
        // Push the number into weightedArray based on its frequency (weight)
        for (let i = 0; i < frequencyMap[number]; i++) {
            weightedArray.push(number);
        }
    });

    // Step 4: Select a random number from the weighted array
    const randomIndex = Math.floor(Math.random() * weightedArray.length);
    return weightedArray[randomIndex];
  }

  

  private async parseWinningNumbers(results: any[]) {
    const plays = results.map((set: { numbers: any }) => set.numbers);

    this.historicalData = _.clone(plays);

    return plays.map((set: any[]) =>
      Object.assign(
        {},
        {
          first: set[0],
          second: set[1],
          third: set[2],
          fourth: set[3],
          fifth: set[4],
          powerball: set[5],
        }
      )
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
      firsts.push(parseInt(set.first));
      seconds.push(parseInt(set.second));
      thirds.push(parseInt(set.third));
      fourths.push(parseInt(set.fourth));
      fifths.push(parseInt(set.fifth));
      powerballs.push(parseInt(set.powerball));

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

    const filteredNumbers = [];

    for (const key in parsedNumberSets) {
      if (parsedNumberSets.hasOwnProperty(key)) {
        let result: any[] = [];
        switch (key) {
          case 'powerball':
            result = this.findDuplicates(parsedNumberSets[key], 3);

            break;
          case 'first':
            const first = this.filterNumbersByRange(parsedNumberSets[key], 1);

            result = this.findDuplicates(first, 3);
            break;
          case 'second':
            const second = this.filterNumbersByRange(parsedNumberSets[key], 1);

            result = this.findDuplicates(second, 3);
            break;
          case 'third':
            const third = this.filterNumbersByRange(parsedNumberSets[key], 1);

            result = this.findDuplicates(third, 3);
            break;
          case 'fourth':
            const fourth = this.filterNumbersByRange(parsedNumberSets[key], 1);

            result = this.findDuplicates(fourth, 3);
            break;
          case 'fifth':
            const fifth = this.filterNumbersByRange(parsedNumberSets[key], 1);

            result = this.findDuplicates(fifth, 3);
            break;
        }

        filteredNumbers.push(Object.assign({}, { key: key, numbers: result }));
      }
    }

    return filteredNumbers;
  }

  private generateNextNumberArray(
    selectedNumber: string,
    customIndex: number = 0 // Optional custom index
  ): string[] {
    return this.findNextNumbers(
      this.historicalData,
      selectedNumber,
      customIndex
    );
  }

  private removeDuplicateStrings(arr: string[]): string[] {
    // Use a Set to automatically handle duplicates
    return [...new Set(arr)];
  }

  // Function to find the numbers that follow the selected number at the given index
  private findNextNumbers(
    data: string[][],
    selectedNumber: string,
    customIndex: number = 0 // Optional custom index for flexibility
  ): string[] {
    const nextNumbers: string[] = [];
    const strippedData = this.stripSixthElement(data); // Strip sixth element

    for (const subArray of strippedData) {
      if (customIndex < 0 || customIndex > 4) continue; // Ensure customIndex is valid

      if (subArray[customIndex] === selectedNumber) {
        // Get the next number if it exists
        if (customIndex < subArray.length - 1) {
          nextNumbers.push(subArray[customIndex + 1]);
        }
      }
    }

    return nextNumbers;
  }

  // Function to remove the 6th element from each sub-array
  private stripSixthElement(data: string[][]): string[][] {
    return data.map((subArray) => subArray.slice(0, 5)); // Take only the first 5 elements
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
    set: any[],
    from: number,
    to: number | null = null
  ) {
    const fromSet = set.filter((number) => {
      return number >= from;
    });

    if (to) {
      const range = fromSet.filter((number) => {
        return number <= to;
      });

      return range;
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

  private pickMostFrequentFirstNumber(powerball:boolean = false) {
    const index = powerball ? 5 : 0;
    // Step 1: Extract the first numbers
    const firstNumbers = this.historicalData.map(subArray => subArray[index]);

    // Step 2: Count the frequency of each number
    const frequencyMap: { [key: string]: number } = {};
    firstNumbers.forEach(number => {
      if (frequencyMap[number]) {
        frequencyMap[number]++;
      } else {
        frequencyMap[number] = 1;
      }
    });

    // Step 3: Find the number with the highest frequency
    let mostFrequentNumber = firstNumbers[0];
    let maxCount = 0;

    for (const number in frequencyMap) {
      if (frequencyMap[number] > maxCount) {
        maxCount = frequencyMap[number];
        mostFrequentNumber = number;
      }
    }

    return mostFrequentNumber;
  }

  private pickWeightedRandomFirstNumber(powerball:boolean = false) {
    const index = powerball ? 5 : 0;
    // Step 1: Extract the first numbers
    const firstNumbers = this.historicalData.map(subArray => subArray[index]);

    // Step 2: Count the frequency of each number
    const frequencyMap: { [key: string]: number } = {};
    firstNumbers.forEach(number => {
      if (frequencyMap[number]) {
        frequencyMap[number]++;
      } else {
        frequencyMap[number] = 1;
      }
    });

    // Step 3: Build a weighted array where each number is added as many times as its frequency
    const weightedArray: string[] = [];
    for (const number in frequencyMap) {
      for (let i = 0; i < frequencyMap[number]; i++) {
        weightedArray.push(number);
      }
    }

    // Step 4: Pick a random number from the weighted array
    const randomIndex = Math.floor(Math.random() * weightedArray.length);
    return weightedArray[randomIndex];
  }

  private pickAdvancedProbabilityNumberWithRecency(bestGuessSet: string[], recencyThreshold: number): string {
    // Step 1: Limit historical data to only rows within the recency threshold
    const recentData = this.historicalData.slice(-recencyThreshold);

    // Step 2: Create a frequency map for numbers in bestGuessSet
    const frequencyMap: { [key: string]: number } = {};

    // Initialize frequency map for bestGuessSet numbers
    bestGuessSet.forEach(number => {
        frequencyMap[number] = 0;
    });

    // Step 3: Count occurrences of each number in recent data with recency bias
    recentData.forEach((row, index) => {
        row.forEach(number => {
            if (bestGuessSet.includes(number)) {
                // Increase count based on recency bias (newer data gets more weight)
                const recencyWeight = recentData.length - index; // More recent rows get higher weights
                frequencyMap[number] += recencyWeight;
            }
        });
    });

    // Step 4: Convert frequencies into a weighted probability array
    const weightedArray: string[] = [];
    bestGuessSet.forEach(number => {
        // Push the number into weightedArray based on its frequency (weight)
        for (let i = 0; i < frequencyMap[number]; i++) {
            weightedArray.push(number);
        }
    });

    // Step 5: Select a random number from the weighted array
    const randomIndex = Math.floor(Math.random() * weightedArray.length);
    return weightedArray[randomIndex];
}

}
