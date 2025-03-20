import { Injectable } from '@angular/core';
import { PowerballData } from '../data/powerball-data';
import {
  anotherSet,
  anotherSixty,
  customPB,
  customPB10,
  customPB11,
  customPB12,
  customPB13,
  customPB5,
  customPB6,
  customPB7,
  customPB9,
  customPBFour,
  customPBThree,
  customPBTwo,
  generatedPicks,
  lastSixty,
  latestPicks,
  mergedPicks,
  mixedDupCount60,
  morePicks,
  newDay,
  newDay11,
  newDayEight,
  newDayFive,
  newDayFour,
  newDayNine,
  newDaySeven,
  newDaySix,
  newDayTen,
  newDayThree,
  newDayTwo,
  newPredictRandom,
  oneTwenty,
  potentialOne,
  potentialTwo,
  predictPlay,
  sixty,
  threeFifty,
} from '../data/generated-picks';
import { PastTwoMonthsHistoricalData } from '../data/historical-data';
import {
  sundayFunday,
  theGoat,
  UniquePicks,
  UniquePicksTwo,
  sundayUni,
  sunday2,
  sundayUniTwo,
  sundayUniThree,
  march22,
  march22V2,
  march19,
  march22V3,
  smallSetOne,
  smallSetTwo,
  smallSetThree,
  smallSetFour,
} from '../data/todays-picks';
import {
  defLastSixty,
  firstThreeSets,
  lastThreeSets,
  my85,
  myLastSixtySets,
  myNextSixtySets,
  mySixtySets,
  newMy85,
  sixSets,
  sixthSet,
  sixtyIteration,
} from '../data/more-picks';
import { promising40 } from '../data/new-gen-picks';
import {
  allThePicks,
  allThePicksFiltered,
  promising40Two,
  quickPicks,
  quickPicksTwo,
  saturdayPicks,
  wednesdayPicks,
  wednesdayPicksTwo,
} from '../data/wednesday-picks';
import {
  FDRAWS,
  FutureGeneratedDraws,
  NewFutureDraws,
  NewFutureDrawsTwo,
} from '../data/future-data';
import _ from 'lodash';
import { BehaviorSubject } from 'rxjs';
import moment from 'moment';
import { banger1, banger2, banger2V2, banger3, banger3V3, banger4, banger4V2, banger6, bangerV5 } from '../data/bangers';

@Injectable({
  providedIn: 'root',
})
export class PickCheckerService {
  historicalDrawings = PowerballData.map((obj: any) => {
    return {
      date: obj.draw_date,
      numbers: obj.winning_numbers.split(' '),
      multiplier: obj.multiplier,
    };
  });

  winningPicks: any = [];

  private chartDataSubject = new BehaviorSubject<string[][]>([]);
  private barChartDataSubject = new BehaviorSubject<string[][]>([]);

  // Expose the chart data as an Observable
  chartData$ = this.chartDataSubject.asObservable();
  barChartData$ = this.barChartDataSubject.asObservable();

  constructor() {}

  checkPicks(myPicks: any) {
    const matchCount = 4;
    const drawingResults: any = [];
    const picks: string[][] = [];

    console.group('myPicks');
    console.log(myPicks);
    console.groupEnd();

    // myPicks = [...banger1, ...banger2,...banger2V2,...banger3, ...banger3V3, ...banger4, ...banger4V2, ...bangerV5];
    // const smallSets = [...smallSetOne, ...smallSetTwo, ...smallSetThree, ...smallSetFour];

    // myPicks = [...customPB, ...banger2V2, ...banger4]; // 41 wins

    // myPicks = [...smallSets, ...banger2V2, ...banger4];

    myPicks = banger6;

    this.historicalDrawings.forEach((draw) => {
      drawingResults.push(this.processPicks(draw, myPicks, matchCount));
    });

    const wins = drawingResults.filter((win: any) => {
      if (win && win.matching_picks) {
        win.month = moment(win.date).format('MMMM');
        win.year = moment(win.date).format('YYYY');

        return win;
      }
    });

    const sortedWins = _.sortBy(wins, 'year');

    drawingResults.forEach((win: any) => {
      if (win && win.matching_picks) {
        const matchingPicks: string[][] = win.matching_picks;
        const historicalDraw = win.historical_draw;

        matchingPicks.forEach((pick: string[]) => {
          if(!_.isEqual(historicalDraw, pick)) {
            picks.push(pick);
          }
        });
      }
    });

    // console.group('PICKS');
    // console.log(this.removeDuplicateArrays(picks));
    // console.groupEnd();

    this.updateChartData(wins);

    const groupedResults: any = _.groupBy(wins, 'year');
    const years = Object.keys(groupedResults);
    const organizedResults = years.map((year: any) => {
      return _.groupBy(groupedResults[year], 'month');
    });

    this.updateBarCharData(organizedResults);

    return {
      totalWins: wins.length,
      totalDraws: this.historicalDrawings.length,
      myPicks: myPicks.length,
      picks: myPicks,
      wins,
      organizedResults,
    };
  }

  // Function that generates new chart data and updates the subject
  updateChartData(newData: string[][]): void {
    this.chartDataSubject.next(newData);
  }

  updateBarCharData(newData: any): void {
    this.barChartDataSubject.next(newData);
  }

  processPicks(draw: any, myPks: any, matchCount: number): any {
    const historicalDraw = draw.numbers;
    const multiplier = draw.multiplier;

    // Remove duplicates from the imported array.
    const uniqueArrays = this.removeDuplicateArrays(myPks);

    // Remove Jackpot Matches
    const filteredPicks = uniqueArrays.filter((pick: string[]) => {
      if(!_.isEqual(historicalDraw, pick)) {
        return pick;
      }

      return;
    });

    console.log(filteredPicks);

    const matchingPicks = this.filterArrays(
      filteredPicks,
      historicalDraw,
      matchCount
    );

    if (matchingPicks.length > 0) {
      const result = {
        // day: moment(draw.date).format('dddd'),
        date: draw.date,
        historical_draw: historicalDraw,
        matching_picks_count: matchingPicks.length,
        matching_picks: matchingPicks,
        multiplier,
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
    return arrays.filter((arr) => {
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
  filterArrays(
    generatedPicks: string[][],
    historicalDraw: string[],
    count: number
  ): string[][] {
    // Create a set for quick lookup of the first five elements of historicalDraw.
    const singleFirstFive = new Set(historicalDraw.slice(0, 5));

    return generatedPicks.filter((subArray) => {
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
