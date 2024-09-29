import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { PowerballData } from './powerball-data';
import * as _ from 'lodash';

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
  fromDate: Date = new Date('2019-01-04T00:00:00');
  powerballData: any;
  private historicalData: string[][] = [];

  constructor(private httpClient: HttpClient) {}

  /**
   * Http request to pull latest data
   */
  // async fetchPowerballResults() {
  //   try {
  //     const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
  //     const url = 'http://data.ny.gov/resource/d6yy-54nr.json';
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

    const initialPlay = filteredParsedSets.map((set) => {
      const numbers = set.numbers;
      console.log(numbers);
      const randomNumber = numbers[Math.floor(Math.random() * numbers.length)];

      return typeof randomNumber === 'number'
        ? randomNumber.toString()
        : randomNumber;
    });

    const firstNumber = initialPlay[0].length === 1 ? `0${initialPlay[0]}` : initialPlay[0];

    const bestGuestSetForSecond = this.generateNextNumberArray(firstNumber, 0);
    const secondNumber = this.pickRandomIndexInArray(_.uniq(bestGuestSetForSecond));

    const bestGuestSetForThird = this.generateNextNumberArray(secondNumber, 1);
    const thirdNumber = this.pickRandomIndexInArray(_.uniq(bestGuestSetForThird));

    const bestGuestSetForForth = this.generateNextNumberArray(thirdNumber, 2);
    const forthNumber = this.pickRandomIndexInArray(_.uniq(bestGuestSetForForth));

    const bestGuestSetForFifth = this.generateNextNumberArray(forthNumber, 3);
    const fifithNumber = this.pickRandomIndexInArray(_.uniq(bestGuestSetForFifth));

    const sixthNumber = initialPlay[5].length === 1 ? `0${initialPlay[5]}` : initialPlay[5];

    console.log({
      payOne: initialPlay,
      playTwo: [firstNumber, secondNumber, thirdNumber, forthNumber, fifithNumber, sixthNumber]
    })

    return [firstNumber, secondNumber, thirdNumber, forthNumber, fifithNumber, sixthNumber];
  }

  private pickRandomIndexInArray(array: string[]): string {
    // Pick a random index between 0 and the length of the array
    const randomIndex = Math.floor(Math.random() * array.length);
  
    // Return the element at the random index
    return array[randomIndex];
  }
  

  private async parseWinningNumbers(results: any[]) {
    const plays = results.map((set: { numbers: any }) => set.numbers);

    this.historicalData = plays;

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

    console.log(parsedNumberSets);

    const filteredNumbers = [];

    for (const key in parsedNumberSets) {
      if (parsedNumberSets.hasOwnProperty(key)) {
        let result: any[] = [];
        switch (key) {
          case 'powerball':
            result = this.findDuplicates(parsedNumberSets[key], 4);

            //console.log('Powerball: ', result);
            // result = [
            //   '1',
            //   '3',
            //   '24',
            //   '5',
            //   '7',
            //   '8',
            //   '12',
            //   '10',
            //   '09',
            //   '15',
            //   '21',
            //   '23',
            //   '25',
            //   '26',
            // ];
            break;
          case 'first':
            // const first = this.filterNumbersByRange(
            //   parsedNumberSets[key],
            //   1,
            //   15
            // );
            const first = this.filterNumbersByRange(parsedNumberSets[key], 1);

            result = this.findDuplicates(first, 5);
            // console.log('First SETS: ', parsedNumberSets[key]);
            console.log('First: ', result);
            break;
          case 'second':
            const second = this.filterNumbersByRange(parsedNumberSets[key], 1);

            result = this.findDuplicates(second, 4);
            // console.log('Second SETS: ', parsedNumberSets[key]);
            console.log('Second: ', result);
            break;
          case 'third':
            // const third = this.filterNumbersByRange(
            //   parsedNumberSets[key],
            //   25,
            //   39
            // );
            const third = this.filterNumbersByRange(parsedNumberSets[key], 1);

            result = this.findDuplicates(third, 4);
            console.log('Third: ', result);
            break;
          case 'fourth':
            // const fourth = this.filterNumbersByRange(
            //   parsedNumberSets[key],
            //   35,
            //   62
            // );
            const fourth = this.filterNumbersByRange(parsedNumberSets[key], 1);

            result = this.findDuplicates(fourth, 4);
            console.log('Forth: ', result);
            break;
          case 'fifth':
            // const fifth = this.filterNumbersByRange(
            //   parsedNumberSets[key],
            //   45,
            //   69
            // );
            const fifth = this.filterNumbersByRange(parsedNumberSets[key], 1);

            result = this.findDuplicates(fifth, 4);
            console.log('Fifth: ', result);
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
}
