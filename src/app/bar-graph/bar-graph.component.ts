import { Component, OnInit } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import {
  BaseChartDirective,
  provideCharts,
  withDefaultRegisterables,
} from 'ng2-charts';
import { PickCheckerService } from '../services/pick-checker.service';
import { Subscription } from 'rxjs';

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
  styleUrl: './bar-graph.component.scss'
})
export class BarGraphComponent implements OnInit {
  barChartType: 'bar' = 'bar';

  barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    plugins: {
      legend: { display: true },
    },
  };

  barChartData!: ChartData<'bar'>;
  subscription!: Subscription;

  constructor(private pickCheckerService: PickCheckerService) {}

  ngOnInit(): void {
    this.subscription = this.pickCheckerService.barChartData$.subscribe((chartData: any[]) => {
          // We'll aggregate by a label in the format "Month Year"
    const aggregated: { [label: string]: number } = {};
    chartData.forEach((obj) => {
      Object.keys(obj).forEach((month) => {
        const wins = obj[month];

        wins.forEach((win: any) => {
          const label = `${win.month} ${win.year}`;

          aggregated[label] = (aggregated[label] || 0) + win.matching_picks_count;
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

    const data = labels.map(label => aggregated[label]);

    // Build the dataset for a bar chart.
    this.barChartData = {
      labels,
      datasets: [
        {
          label: 'Total Winners',
          data,
          backgroundColor: 'rgba(239, 23, 185, 0.60)',
          borderColor: 'rgba(239, 23, 185, 1)',
          borderWidth: 1,
        },
      ],
    };

    console.group('organizedResults');
    console.log(chartData);
    console.groupEnd();
    });
  }
}
