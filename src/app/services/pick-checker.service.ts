import { Injectable } from '@angular/core';
import { PowerballData } from '../data/powerball-data';
import { groupBy, isEqual } from 'lodash';
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
    myPicks = [
      ['06', '17', '20', '43', '66', '20'],
      ['04', '14', '18', '23', '56', '15'],
      ['23', '36', '47', '48', '63', '20'],
      ['12', '49', '53', '62', '65', '15'],
      ['16', '21', '27', '66', '67', '05'],
      ['15', '28', '30', '48', '55', '09'],
      ['08', '17', '59', '60', '64', '20'],
      ['09', '20', '36', '44', '52', '15'],
      ['06', '37', '42', '44', '60', '02'],
      ['09', '40', '45', '58', '66', '01'],
      ['04', '13', '15', '46', '53', '14'],
      ['40', '53', '57', '64', '69', '03'],
      ['02', '17', '27', '42', '62', '24'],
      ['07', '32', '40', '42', '43', '14'],
      ['11', '49', '51', '67', '68', '21'],
      ['03', '05', '38', '48', '69', '03'],
      ['15', '32', '35', '36', '51', '04'],
      ['08', '20', '23', '53', '58', '14'],
      ['09', '15', '24', '25', '50', '06'],
      ['08', '41', '55', '63', '66', '01'],
      ['02', '35', '43', '49', '61', '24'],
      ['23', '33', '35', '50', '52', '13'],
      ['01', '06', '30', '45', '65', '04'],
      ['09', '23', '29', '39', '65', '04'],
      ['16', '35', '40', '56', '65', '15'],
      ['17', '18', '19', '54', '61', '19'],
      ['02', '18', '22', '31', '33', '09'],
      ['07', '45', '49', '56', '59', '15'],
      ['07', '17', '38', '46', '52', '05'],
      ['12', '34', '40', '46', '55', '09'],
      ['15', '17', '31', '47', '49', '24'],
      ['10', '28', '43', '52', '67', '18'],
      ['04', '12', '24', '41', '57', '24'],
      ['16', '20', '55', '61', '64', '09'],
      ['09', '28', '47', '61', '62', '24'],
      ['11', '21', '52', '57', '61', '18'],
      ['08', '29', '34', '38', '50', '15'],
      ['07', '13', '14', '35', '64', '09'],
      ['06', '21', '51', '55', '59', '21'],
      ['12', '43', '44', '59', '63', '06'],
      ['05', '32', '47', '58', '67', '20'],
      ['03', '14', '31', '53', '59', '20'],
      ['08', '27', '28', '31', '39', '18'],
      ['05', '11', '18', '34', '35', '09'],
      ['01', '27', '34', '47', '52', '21'],
      ['01', '16', '23', '37', '68', '24'],
      ['03', '28', '32', '63', '64', '17'],
      ['03', '07', '18', '47', '68', '06'],
      ['08', '26', '36', '54', '56', '16'],
      ['19', '20', '37', '62', '69', '14'],
      ['04', '08', '16', '44', '49', '17'],
      ['39', '55', '56', '60', '67', '20'],
      ['06', '33', '39', '54', '62', '18'],
      ['04', '09', '17', '22', '32', '08'],
      ['30', '34', '54', '67', '69', '09'],
      ['26', '28', '29', '33', '40', '09'],
      ['01', '04', '20', '42', '50', '11'],
      ['22', '37', '40', '49', '52', '04'],
      ['05', '07', '15', '19', '33', '14'],
      ['01', '07', '12', '29', '61', '22'],
      ['08', '11', '34', '59', '68', '20'],
      ['02', '17', '23', '24', '60', '22'],
      ['03', '16', '45', '46', '51', '20'],
      ['02', '12', '22', '41', '61', '25'],
      ['23', '40', '47', '52', '57', '01'],
      ['05', '06', '09', '23', '59', '15'],
      ['04', '21', '23', '27', '33', '21'],
      ['04', '11', '40', '43', '62', '12'],
      ['20', '23', '36', '43', '62', '08'],
      ['09', '12', '37', '51', '61', '18'],
      ['12', '28', '40', '43', '62', '25'],
      ['06', '18', '34', '50', '55', '05'],
      ['23', '40', '49', '65', '69', '19'],
      ['01', '28', '34', '35', '59', '06'],
      ['03', '16', '41', '64', '69', '18'],
      ['12', '18', '34', '59', '68', '12'],
      ['03', '06', '09', '23', '59', '21'],
      ['03', '16', '24', '29', '43', '26'],
      ['02', '40', '49', '65', '69', '18'],
      ['04', '11', '28', '35', '36', '03'],
    ];
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

    // Track target wins: 4 white matches and 3 white + powerball matches
    const targetWins = this.filterArraysForTargetWins(
      myPicks,
      this.historicalDrawings
    );

    return {
      totalWins: wins.length,
      totalDraws: this.historicalDrawings.length,
      myPicks: myPicks.length,
      picks: myPicks,
      wins,
      organizedResults,
      targetWins,
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

  /**
   * Filters arrays to identify target wins:
   * - Exactly 4 white ball matches (regardless of powerball)
   * - Exactly 3 white ball matches + powerball match
   *
   * @param myPicks - The picks to check against historical draws
   * @param historicalDrawings - Historical drawing data
   * @returns Object containing arrays of target wins
   */
  filterArraysForTargetWins(
    myPicks: string[][],
    historicalDrawings: HistoricalDrawing[]
  ): { fourWhite: Win[]; threeWhitePowerball: Win[] } {
    const fourWhiteWins: Win[] = [];
    const threeWhitePowerballWins: Win[] = [];

    // Remove duplicates from picks
    const uniquePicks = this.removeDuplicateArrays(myPicks);

    historicalDrawings.forEach((draw) => {
      const historicalDraw = draw.numbers;
      const singleFirstFive = new Set(historicalDraw.slice(0, 5));

      const fourWhiteMatches: string[][] = [];
      const threeWhitePowerballMatches: string[][] = [];

      // Check each pick against this historical draw
      uniquePicks.forEach((pick) => {
        let whiteMatchCount = 0;

        // Count white ball matches (indices 0-4)
        for (let i = 0; i < 5; i++) {
          if (singleFirstFive.has(pick[i])) {
            whiteMatchCount++;
          }
        }

        const powerballMatches = pick[5] === historicalDraw[5];

        // Check for exactly 4 white matches (regardless of powerball)
        if (whiteMatchCount === 4) {
          fourWhiteMatches.push(pick);
        }

        // Check for exactly 3 white matches + powerball match
        if (whiteMatchCount === 3 && powerballMatches) {
          threeWhitePowerballMatches.push(pick);
        }
      });

      // Create Win objects for draws that have matching picks
      if (fourWhiteMatches.length > 0) {
        const win: Win = {
          date: draw.date,
          historical_draw: historicalDraw,
          matching_picks_count: fourWhiteMatches.length,
          matching_picks: fourWhiteMatches,
          multiplier: draw.multiplier,
          month: moment(draw.date).format('MMMM'),
          year: moment(draw.date).format('YYYY'),
          picks: myPicks,
        };
        fourWhiteWins.push(win);
      }

      if (threeWhitePowerballMatches.length > 0) {
        const win: Win = {
          date: draw.date,
          historical_draw: historicalDraw,
          matching_picks_count: threeWhitePowerballMatches.length,
          matching_picks: threeWhitePowerballMatches,
          multiplier: draw.multiplier,
          month: moment(draw.date).format('MMMM'),
          year: moment(draw.date).format('YYYY'),
          picks: myPicks,
        };
        threeWhitePowerballWins.push(win);
      }
    });

    return {
      fourWhite: fourWhiteWins,
      threeWhitePowerball: threeWhitePowerballWins,
    };
  }

  formatCurrency(amount: number, currency: string = 'USD'): string {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    });

    return formatter.format(amount);
  }
}
