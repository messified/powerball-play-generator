import { Component, OnInit } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import {
  BaseChartDirective,
  provideCharts,
  withDefaultRegisterables,
} from 'ng2-charts';
import { PickCheckerService } from '../services/pick-checker.service';
import { Subscription } from 'rxjs';

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
          (chartData[1])
        ) {
          const augustWins = chartData[1]['December'];
          if (augustWins && augustWins.length > 0) {
            console.group('December Results');
            alert('Yay!!!');
            console.group('organizedResults');
            console.log(chartData);
            console.groupEnd();
            augustWins.forEach((ap: any) => {
              console.log(ap);
              console.log(ap.date);
              console.log('historical_draw: ', ap.historical_draw);
              console.log('matching_picks: ', ap.matching_picks[0]);
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
