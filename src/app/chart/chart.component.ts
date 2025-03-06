import { Component, OnInit } from '@angular/core';
import {
  ChartConfiguration,
  ChartData,
  ChartOptions,
  ChartType,
} from 'chart.js';
import {
  BaseChartDirective,
  provideCharts,
  withDefaultRegisterables,
} from 'ng2-charts';
import { PickCheckerService } from '../services/pick-checker.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chart',
  standalone: true,
  imports: [BaseChartDirective],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './chart.component.html',
  styleUrl: './chart.component.scss'
})
export class ChartComponent implements OnInit {
  wins: any[] = [
    {
      date: '2025-02-17T00:00:00.000',
      historical_draw: ['04', '44', '47', '52', '57', '09'],
      matching_picks_count: 1,
      matching_picks: [['19', '27', '44', '52', '57', '17']],
      multiplier: '4',
    }
  ]; // This would come from your data service or JSON

  // Define the chart type as 'line'
  chartType: 'line' = 'line';

  // Chart options for responsiveness and styling
  chartOptions: ChartOptions<'line'> = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
      },
    },
  };

  // The dataset we'll generate from the provided data
  chartData!: ChartData<'line'>;
  subscription!: Subscription;

  constructor(private pickCheckerService: PickCheckerService) {}

  ngOnInit(): void {
    this.wins = [];
    // Subscribe to the BehaviorSubject to get updated chart data
    this.subscription = this.pickCheckerService.chartData$.subscribe(
      (data: any[]) => {
        if (data.length > 0) {
          this.wins = data;
        }

        // Sort the data by date (oldest to newest)
        const sortedData = this.wins.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        

        // Prepare labels (dates) and data (multipliers)
        const labels = sortedData.map((entry) =>
          new Date(entry.date).toLocaleDateString()
        );
        const matchingPicks = this.wins.map((entry) => Number(entry.matching_picks_count));

        // Build the dataset compatible with Chart.js
        this.chartData = {
          labels: labels,
          datasets: [
            {
              label: 'Matching Picks Over Time',
              data: matchingPicks,
              borderColor: 'rgb(7, 160, 28)',
              backgroundColor: 'rgb(255, 255, 255)',
              fill: true,
              tension: 0.1,
            },
          ],
        };
      }
    );
  }
}
