import { Injectable } from '@angular/core';
import { PowerballData } from '../data/powerball-data';
import _ from 'lodash';
import { BehaviorSubject } from 'rxjs';
import moment from 'moment';
import { 
  HistoricalDrawing, 
  DrawingResult, 
  Win, 
  CheckPicksResult 
} from '../models/powerball-draw.interface';

@Injectable({
  providedIn: 'root',
})
export class PickCheckerService {
  historicalDrawings: HistoricalDrawing[] = PowerballData.map((obj) => {
    return {
      date: obj.draw_date,
      numbers: obj.winning_numbers.split(' '),
      multiplier: obj.multiplier,
    };
  });

  winningPicks: string[][] = [];

  private chartDataSubject = new BehaviorSubject<Win[]>([]);
  private barChartDataSubject = new BehaviorSubject<Array<Record<string, Win[]>>>([]);

  // Expose the chart data as an Observable
  chartData$ = this.chartDataSubject.asObservable();
  barChartData$ = this.barChartDataSubject.asObservable();

  constructor() {}

  checkPicks(myPicks: string[][]): CheckPicksResult {
    const matchCount = 5;
    const drawingResults: (DrawingResult | undefined)[] = [];

    this.historicalDrawings.forEach((draw) => {
      drawingResults.push(this.processPicks(draw, myPicks, matchCount));
    });

    const wins: Win[] = drawingResults.filter((win): win is DrawingResult => {
      return win !== undefined && win.matching_picks !== undefined;
    }).map((win) => {
      return {
        ...win,
        month: moment(win.date).format('MMMM'),
        year: moment(win.date).format('YYYY'),
        picks: myPicks,
      };
    });

    this.updateChartData(wins);

    const groupedResults: Record<string, Win[]> = _.groupBy(wins, 'year');
    const years = Object.keys(groupedResults);
    const organizedResults = years.map((year) => {
      return _.groupBy(groupedResults[year], 'month');
    });

    this.updateBarChartData(organizedResults);

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
  updateChartData(chartData: Win[]): void {
    this.chartDataSubject.next(chartData);
  }

  updateBarChartData(newData: Array<Record<string, Win[]>>): void {
    this.barChartDataSubject.next(newData);
  }

  processPicks(
    draw: HistoricalDrawing, 
    myPks: string[][], 
    matchCount: number
  ): DrawingResult | undefined {
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

    const matchingPicks = this.filterArrays(
      filteredPicks,
      historicalDraw,
      matchCount
    );

    if (matchingPicks.length > 0) {
      const result: DrawingResult = {
        date: draw.date,
        historical_draw: historicalDraw,
        matching_picks_count: matchingPicks.length,
        matching_picks: matchingPicks,
        multiplier,
      };

      return result;
    }

    return undefined;
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
