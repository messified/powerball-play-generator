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
    const matchCount = 3;
    const drawingResults: (DrawingResult | undefined)[] = [];

    // myPicks = [
    //   ['07', '20', '31', '36', '52', '25'],
    //   ['35', '36', '37', '44', '66', '02'],
    //   ['08', '14', '17', '40', '54', '11'],
    //   ['18', '20', '40', '43', '62', '25'],
    //   ['06', '25', '26', '29', '43', '07'],
    //   ['07', '08', '28', '64', '66', '13'],
    //   ['03', '13', '52', '64', '67', '20'],
    //   ['07', '27', '49', '50', '69', '05'],
    //   ['12', '32', '34', '52', '66', '01'],
    //   ['06', '33', '40', '49', '60', '14'],
    //   ['05', '10', '20', '41', '66', '14'],
    //   ['02', '05', '24', '37', '67', '20'],
    //   ['16', '21', '23', '49', '52', '25'],
    //   ['35', '39', '52', '57', '58', '05'],
    //   ['16', '28', '31', '33', '65', '05'],
    //   ['11', '19', '32', '59', '67', '25'],
    //   ['23', '35', '48', '56', '61', '24'],
    //   ['10', '45', '48', '58', '64', '20'],
    //   ['11', '12', '13', '21', '63', '08'],
    //   ['13', '17', '46', '60', '69', '17'],
    //   ['15', '27', '30', '31', '59', '01'],
    //   ['04', '06', '13', '16', '66', '03'],
    //   ['04', '05', '39', '47', '54', '05'],
    //   ['17', '31', '45', '67', '68', '20'],
    //   ['12', '27', '43', '61', '68', '09'],
    //   ['11', '36', '49', '53', '68', '23'],
    //   ['17', '41', '47', '52', '55', '07'],
    //   ['04', '08', '12', '55', '58', '23'],
    //   ['03', '10', '16', '29', '37', '08'],
    //   ['21', '50', '51', '54', '67', '14'],
    //   ['03', '15', '50', '61', '66', '13'],
    //   ['29', '38', '39', '40', '53', '17'],
    //   ['18', '23', '32', '45', '63', '04'],
    //   ['20', '55', '56', '60', '65', '05'],
    //   ['02', '13', '32', '55', '61', '20'],
    //   ['16', '26', '42', '46', '61', '21'],
    //   ['16', '25', '41', '44', '53', '02'],
    //   ['22', '37', '48', '53', '60', '15'],
    //   ['07', '23', '43', '47', '59', '05'],
    //   ['28', '32', '37', '50', '58', '20'],
    //   ['01', '08', '31', '37', '43', '23'],
    //   ['04', '26', '53', '57', '69', '20'],
    //   ['04', '10', '28', '34', '59', '11'],
    //   ['21', '24', '40', '44', '47', '20'],
    //   ['06', '08', '21', '59', '62', '04'],
    //   ['05', '13', '23', '25', '68', '24'],
    //   ['02', '09', '28', '52', '56', '25'],
    //   ['28', '30', '36', '41', '48', '13'],
    //   ['06', '14', '20', '23', '57', '06'],
    //   ['01', '14', '25', '49', '51', '24'],
    //   ['25', '32', '36', '40', '46', '25'],
    //   ['09', '30', '44', '57', '61', '25'],
    //   ['06', '07', '12', '19', '38', '12'],
    //   ['19', '30', '53', '54', '64', '20'],
    //   ['06', '11', '15', '35', '64', '18'],
    //   ['02', '03', '18', '19', '65', '04'],
    //   ['01', '16', '45', '50', '60', '24'],
    //   ['03', '12', '26', '36', '47', '14'],
    //   ['02', '17', '25', '50', '57', '18'],
    //   ['01', '15', '19', '62', '68', '21'],
    //   ['07', '35', '43', '52', '64', '20'],
    //   ['04', '33', '40', '43', '62', '06'],
    //   ['04', '21', '28', '35', '45', '20'],
    //   ['01', '07', '25', '28', '69', '20'],
    //   ['06', '12', '28', '33', '42', '21'],
    //   ['12', '18', '23', '27', '52', '21'],
    //   ['17', '34', '46', '66', '67', '25'],
    //   ['17', '21', '43', '48', '62', '18'],
    //   ['28', '48', '51', '56', '68', '14'],
    //   ['08', '15', '35', '50', '62', '09'],
    //   ['23', '44', '63', '66', '67', '12'],
    //   ['06', '07', '25', '28', '69', '18'],
    //   ['04', '35', '36', '44', '49', '14'],
    //   ['13', '25', '29', '37', '65', '18'],
    //   ['09', '29', '50', '52', '62', '23'],
    //   ['02', '18', '19', '25', '35', '14'],
    //   ['15', '44', '63', '66', '69', '22'],
    //   ['23', '44', '57', '65', '67', '05'],
    //   ['12', '28', '44', '57', '59', '20'],
    //   ['07', '35', '36', '43', '52', '15'],
    // ];

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
