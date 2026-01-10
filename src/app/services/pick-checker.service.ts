import { Injectable } from '@angular/core';
import { PowerballData } from '../data/powerball-data';
import { groupBy, isEqual, cloneDeep } from 'lodash';
import { BehaviorSubject } from 'rxjs';
import moment from 'moment';
import {
  HistoricalDrawing,
  DrawingResult,
  Win,
  CheckPicksResult,
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
  private barChartDataSubject = new BehaviorSubject<
    Array<Record<string, Win[]>>
  >([]);

  // Expose the chart data as an Observable
  chartData$ = this.chartDataSubject.asObservable();
  barChartData$ = this.barChartDataSubject.asObservable();

  constructor() {}

  checkPicks(myPicks: string[][]): CheckPicksResult {
    const matchCount = 4;
    const drawingResults: (DrawingResult | undefined)[] = [];

    /**myPicks = [
      ['23', '31', '35', '45', '62', '21'],
      ['04', '13', '22', '54', '69', '04'],
      ['06', '29', '35', '40', '43', '20'],
      ['14', '21', '62', '63', '66', '12'],
      ['32', '48', '53', '55', '67', '24'],
      ['05', '20', '52', '53', '58', '12'],
      ['16', '41', '49', '67', '68', '24'],
      ['25', '27', '28', '38', '62', '23'],
      ['12', '45', '59', '63', '68', '20'],
      ['02', '06', '23', '49', '57', '12'],
      ['07', '12', '18', '24', '58', '25'],
      ['07', '17', '28', '52', '69', '24'],
      ['30', '55', '57', '65', '66', '09'],
      ['15', '30', '33', '41', '69', '20'],
      ['02', '05', '07', '61', '65', '25'],
      ['12', '23', '47', '52', '60', '11'],
      ['09', '24', '35', '36', '68', '15'],
      ['08', '39', '58', '62', '65', '11'],
      ['02', '08', '32', '41', '66', '18'],
      ['08', '29', '33', '36', '42', '06'],
      ['01', '53', '56', '59', '65', '25'],
      ['16', '17', '23', '40', '65', '21'],
      ['15', '18', '20', '40', '60', '14'],
      ['07', '30', '37', '46', '62', '10'],
      ['18', '34', '37', '43', '56', '13'],
      ['09', '43', '47', '51', '63', '13'],
      ['01', '32', '38', '58', '61', '14'],
      ['07', '32', '40', '42', '49', '18'],
      ['05', '13', '32', '33', '60', '26'],
      ['02', '03', '15', '36', '54', '01'],
      ['05', '18', '30', '35', '38', '09'],
      ['03', '12', '19', '34', '65', '02'],
      ['11', '26', '28', '35', '48', '24'],
      ['15', '44', '45', '50', '52', '09'],
      ['08', '12', '28', '43', '55', '09'],
      ['16', '34', '51', '61', '69', '07'],
      ['06', '45', '54', '60', '61', '26'],
      ['08', '18', '31', '49', '64', '14'],
      ['06', '31', '33', '50', '63', '14'],
      ['18', '23', '27', '39', '53', '18'],
      ['13', '42', '45', '46', '64', '25'],
      ['01', '17', '27', '45', '55', '24'],
      ['12', '14', '30', '48', '50', '24'],
      ['02', '04', '17', '51', '56', '14'],
      ['37', '42', '50', '53', '69', '23'],
      ['26', '27', '34', '46', '50', '05'],
      ['22', '42', '52', '57', '62', '18'],
      ['17', '32', '43', '44', '54', '04'],
      ['04', '09', '11', '40', '62', '18'],
      ['03', '24', '33', '37', '66', '20'],
      ['10', '13', '16', '55', '56', '24'],
      ['18', '28', '29', '44', '61', '09'],
      ['14', '24', '55', '59', '61', '14'],
      ['01', '41', '48', '54', '63', '08'],
      ['21', '44', '55', '58', '69', '25'],
      ['04', '06', '08', '10', '48', '06'],
      ['08', '26', '53', '54', '57', '09'],
      ['06', '13', '14', '28', '51', '12'],
      ['25', '36', '46', '59', '67', '24'],
      ['06', '15', '22', '25', '65', '25'],
      ['33', '35', '58', '61', '69', '26'],
      ['01', '02', '03', '57', '61', '14'],
      ['16', '34', '40', '45', '53', '20'],
      ['10', '21', '23', '35', '45', '20'],
      ['07', '19', '21', '54', '63', '20'],
      ['15', '16', '45', '54', '56', '25'],
      ['03', '20', '36', '43', '62', '15'],
      ['08', '11', '21', '54', '63', '18'],
      ['12', '18', '23', '35', '66', '18'],
      ['05', '25', '42', '43', '62', '06'],
      ['23', '29', '50', '52', '64', '12'],
      ['17', '21', '28', '51', '58', '12'],
      ['10', '11', '21', '49', '61', '07'],
      ['09', '29', '50', '64', '69', '12'],
      ['04', '29', '31', '33', '42', '14'],
      ['01', '29', '31', '34', '43', '24'],
      ['04', '44', '63', '66', '69', '22'],
      ['20', '24', '42', '44', '65', '13'],
      ['10', '21', '43', '48', '52', '14'],
      ['02', '23', '35', '64', '67', '15'],
    ];*/
    this.historicalDrawings.forEach((draw) => {
      drawingResults.push(this.processPicks(draw, myPicks, matchCount));
    });

    const wins: Win[] = drawingResults
      .filter((win): win is DrawingResult => {
        return win !== undefined && win.matching_picks !== undefined;
      })
      .map((win) => {
        return {
          ...win,
          month: moment(win.date).format('MMMM'),
          year: moment(win.date).format('YYYY'),
          picks: myPicks,
        };
      });

    this.updateChartData(wins);

    const groupedResults: Record<string, Win[]> = groupBy(wins, 'year');
    const years = Object.keys(groupedResults);
    const organizedResults = years.map((year) => {
      return groupBy(groupedResults[year], 'month');
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
      if (!isEqual(historicalDraw, pick)) {
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
