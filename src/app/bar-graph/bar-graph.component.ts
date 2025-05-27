import { Component, OnInit } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import {
  BaseChartDirective,
  provideCharts,
  withDefaultRegisterables,
} from 'ng2-charts';
import { PickCheckerService } from '../services/pick-checker.service';
import { Subscription } from 'rxjs';
import _ from 'lodash';

// export const chartData: any[] = [
//   {
//     'December': [
//       {
//         date: '2024-12-16T00:00:00.000',
//         historical_draw: ['09', '30', '33', '57', '61', '17'],
//         matching_picks_count: 1,
//         matching_picks: [['09', '30', '33', '57', '61', '23']],
//         multiplier: '2',
//         month: 'December',
//         year: '2024',
//       },
//     ],
//     'August': [
//       {
//         date: '2024-08-31T00:00:00.000',
//         historical_draw: ['04', '34', '35', '38', '69', '19'],
//         matching_picks_count: 1,
//         matching_picks: [['04', '34', '35', '38', '69', '05']],
//         multiplier: '2',
//         month: 'August',
//         year: '2024',
//       },
//       {
//         date: '2024-08-05T00:00:00.000',
//         historical_draw: ['29', '42', '44', '51', '54', '12'],
//         matching_picks_count: 1,
//         matching_picks: [['16', '29', '42', '51', '54', '16']],
//         multiplier: '2',
//         month: 'August',
//         year: '2024',
//       },
//     ],
//     'June': [
//       {
//         date: '2024-06-15T00:00:00.000',
//         historical_draw: ['04', '36', '48', '54', '56', '02'],
//         matching_picks_count: 1,
//         matching_picks: [['04', '36', '48', '54', '55', '02']],
//         multiplier: '3',
//         month: 'June',
//         year: '2024',
//       },
//     ],
//     'April': [
//       {
//         date: '2024-04-10T00:00:00.000',
//         historical_draw: ['06', '07', '12', '24', '36', '15'],
//         matching_picks_count: 1,
//         matching_picks: [['01', '06', '07', '12', '24', '16']],
//         multiplier: '2',
//         month: 'April',
//         year: '2024',
//       },
//     ],
//     'February': [
//       {
//         date: '2024-02-26T00:00:00.000',
//         historical_draw: ['24', '29', '42', '51', '54', '16'],
//         matching_picks_count: 1,
//         matching_picks: [['16', '29', '42', '51', '54', '16']],
//         multiplier: '3',
//         month: 'February',
//         year: '2024',
//       },
//     ],
//   },
//   {
//     'March': [
//       {
//         date: '2025-03-01T00:00:00.000',
//         historical_draw: ['02', '23', '36', '44', '49', '25'],
//         matching_picks_count: 1,
//         matching_picks: [['02', '23', '36', '44', '49', '15']],
//         multiplier: '3',
//         month: 'March',
//         year: '2025',
//       },
//     ],
//   },
// ];

@Component({
  selector: 'app-bar-graph',
  standalone: true,
  imports: [BaseChartDirective],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './bar-graph.component.html',
  styleUrl: './bar-graph.component.scss',
})
export class BarGraphComponent implements OnInit {
  barChartType: 'bar' = 'bar';

  barChartOptions: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    plugins: {
      legend: {
        labels: {
          font: {
            size: 10,
          },
        },
        display: true,
      },
    },
  };

  barChartData!: ChartData<'bar'>;
  subscription!: Subscription;

  constructor(private pickCheckerService: PickCheckerService) {}

  ngOnInit(): void {
    this.subscription = this.pickCheckerService.barChartData$.subscribe(
      (chartData: any[]) => {
        const aggregated: { [label: string]: number } = {};

        chartData.forEach((obj) => {
          Object.keys(obj).forEach((month) => {
            const wins = obj[month];

            wins.forEach((win: any) => {
              const label = `${win.month} ${win.year}`;

              aggregated[label] =
                (aggregated[label] || 0) + win.matching_picks_count;
            });
          });
        });

        // To sort the labels chronologically, map month names to numbers.
        const monthOrder: { [key: string]: number } = {
          January: 1,
          February: 2,
          March: 3,
          April: 4,
          May: 5,
          June: 6,
          July: 7,
          August: 8,
          September: 9,
          October: 10,
          November: 11,
          December: 12,
        };

        const labels = Object.keys(aggregated).sort((a, b) => {
          // Split the label into month and year parts.
          const [monthA, yearA] = a.split(' ');
          const [monthB, yearB] = b.split(' ');
          const dateA = new Date(Number(yearA), monthOrder[monthA] - 1);
          const dateB = new Date(Number(yearB), monthOrder[monthB] - 1);
          return dateA.getTime() - dateB.getTime();
        });

        const data = labels.map((label) => aggregated[label]);

        // Build the dataset for a bar chart.
        this.barChartData = {
          labels,
          datasets: [
            {
              label: 'Total Winners',
              data,
              backgroundColor: '#e5193657',
              borderColor: '#e51936',
              borderWidth: 1,
            },
          ],
        };

        if (
          (chartData[1] && chartData[1]['March']) ||
          (chartData[1] && chartData[1]['February']) ||
          (chartData[1] && chartData[1]['January'])
        ) {
          const janWins = chartData[1]['January'];
          const febWins = chartData[1]['February'];
          const marchWins = chartData[1]['March'];
          const aprilWins = chartData[1]['April'];
          const mayWins = chartData[1]['May'];

          console.group('organizedResults');
          console.log(chartData);
          console.groupEnd();

          // if (janWins && janWins.length > 0) {
          //   console.group('January Results');
          //   janWins.forEach((jw: any) => {
          //     console.log(jw);
          //     console.log(jw.date);
          //     console.log('historical_draw: ', jw.historical_draw);
          //     console.log('matching_picks: ', jw.matching_picks[0]);
          //     console.log('matches: ', this.findDuplicates(jw.matching_picks, jw.historical_draw));
          //   });
          //   console.groupEnd();
          // }

          // if (febWins && febWins.length > 0) {
          //   console.group('February Results');
          //   febWins.forEach((fw: any) => {
          //     console.log(fw);
          //     console.log(fw.date);
          //     console.log('historical_draw: ', fw.historical_draw);
          //     console.log('matching_picks: ', fw.matching_picks[0]);
          //     console.log('matches: ', this.findDuplicates(fw.matching_picks, fw.historical_draw));
          //   });
          //   console.groupEnd();
          // }

          // if (marchWins && marchWins.length > 0) {
          //   console.group('March Results');
          //   marchWins.forEach((mw: any) => {
          //     console.log(mw);
          //     console.log(mw.date);
          //     console.log('historical_draw: ', mw.historical_draw);
          //     console.log('matching_picks: ', mw.matching_picks[0]);
          //     console.log('matches: ', this.findDuplicates(mw.matching_picks, mw.historical_draw));
          //   });
          //   console.groupEnd();
          // }

          if (aprilWins && aprilWins.length > 0) {
            alert('April WINNER :)');
            console.group('April Results');
            aprilWins.forEach((ap: any) => {
              console.log(ap);
              console.log(ap.date);
              console.log('historical_draw: ', ap.historical_draw);
              console.log('matching_picks: ', ap.matching_picks[0]);
              console.log('matches: ', this.findDuplicates(ap.matching_picks, ap.historical_draw));
            });
            console.groupEnd();
          }

          if (mayWins && mayWins.length > 0) {
            alert('May WINNER :)');
            console.group('May Results');
            mayWins.forEach((ap: any) => {
              console.log(ap);
              console.log(ap.date);
              console.log('historical_draw: ', ap.historical_draw);
              console.log('matching_picks: ', ap.matching_picks[0]);
              console.log('matches: ', this.findDuplicates(ap.matching_picks, ap.historical_draw));
            });
            console.groupEnd();
          }
        }
      }
    );
  }

  findDuplicates(arr1: string[], arr2: string[]) {
    return;
  }
}
