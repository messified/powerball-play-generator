import { Injectable } from '@angular/core';
import { PowerballData } from '../data/powerball-data';
import { anotherSet, anotherSixty, customPB, customPB10, customPB11, customPB12, customPB13, customPB5, customPB6, customPB7, customPB9, customPBFour, customPBThree, customPBTwo, generatedPicks, lastSixty, latestPicks, mergedPicks, mixedDupCount60, morePicks, newDay, newDay11, newDayEight, newDayFive, newDayFour, newDayNine, newDaySeven, newDaySix, newDayTen, newDayThree, newDayTwo, newPredictRandom, oneTwenty, potentialOne, potentialTwo, predictPlay, sixty, threeFifty } from '../data/generated-picks';

@Injectable({
  providedIn: 'root'
})
export class PickCheckerService {

  historicalDrawings = PowerballData.map((obj: any) => {
    return {
      date: obj.draw_date,
      numbers: obj.winning_numbers.split(' '),
      multiplier: obj.multiplier
    }
  });

  constructor() { }

  checkPicks(myPicks: any) {
    /**
     * TEST NUMBERS HERE
     * customPB
     * customPBFour
     * newDayNine
     */
    // const myPicks = [...sixty, ...mergedPicks]; // HERE <===========
    // const myPicks = [...customPB, ...newDayFour];
    // const myPicks = [...newDayFour,...newDay11]; // Prospect
    // const myPicks = [...potentialOne, ...potentialTwo];
    const matchCount = 4;
    const drawingResults: any = [];
    
    this.historicalDrawings.forEach(draw => {
      drawingResults.push(this.processPicks(draw, myPicks, matchCount));
    });

    const wins = drawingResults.filter((win: any) => {
      if (win && win.matching_picks) {
        return win;
      }
    });

    return {
      totalWins: wins.length,
      totalDraws: PowerballData.length,
      myPicks: myPicks.length,
      wins
    }
  }

  processPicks(draw: any, myPk: any, matchCount: number): any {
    const historicalDraw = draw.numbers;
    const multiplier = draw.multiplier;

    // Remove duplicates from the imported array.
    // const uniqueArrays = removeDuplicateArrays(generatedPicks);
    const uniqueArrays = this.removeDuplicateArrays(myPk);

    console.log('uniqueArrays: ', uniqueArrays.length);

    const matchingPicks = this.filterArrays(uniqueArrays, historicalDraw, matchCount);

    if (matchingPicks.length > 0) {
      const result = {
        // day: moment(draw.date).format('dddd'),
        date: draw.date,
        historical_draw: historicalDraw,
        matching_picks: matchingPicks,
        multiplier
      };

      return result;
    }
  }

  /**
   * Removes duplicate arrays from an array of arrays.
   * Two arrays are considered duplicates if they have the same elements in the same order.
   *
   * @param arrays - The array of arrays to deduplicate.
   * @returns A new array of arrays with duplicates removed.
   */
  removeDuplicateArrays(arrays: string[][]): string[][] {
    const seen = new Set<string>();
    return arrays.filter(arr => {
      const key = arr.join(',');
      if (seen.has(key)) {
        return false;
      } else {
        seen.add(key);
        return true;
      }
    });
  }

  /**
   * Filters arrays by checking matches only in specific positions:
   * - For indices 0–4, a match is counted if the value in the sub-array is found anywhere in the historicalDraw's indices 0–4.
   * - For index 5, a match is only counted if the value exactly equals the historicalDraw’s index 5 value.
   *
   * @param generatedPicks - The array of arrays to filter.
   * @param historicalDraw - The array used for comparison.
   * @returns A new array of arrays that have at least three matching values as defined.
   */
  filterArrays(generatedPicks: string[][], historicalDraw: string[], count: number): string[][] {
    // Create a set for quick lookup of the first five elements of historicalDraw.
    const singleFirstFive = new Set(historicalDraw.slice(0, 5));

    return generatedPicks.filter(subArray => {
      let matchCount = 0;

      // Only consider indices 0 to 4.
      for (let i = 0; i < 5; i++) {
        if (singleFirstFive.has(subArray[i])) {
          matchCount++;
        }
      }

      // For index 5, count a match only if it exactly matches the historicalDraw's index 5.
      if (subArray[5] === historicalDraw[5]) {
        matchCount++;
      }

      if (matchCount <= 2 && subArray[5] !== historicalDraw[5]) {
        matchCount = 0;
      }

      return matchCount >= count;
    });
  }

  formatCurrency(amount: number, currency: string = 'USD'): string {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    });

    return formatter.format(amount);
  }
}
