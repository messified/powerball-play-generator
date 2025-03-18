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

interface Win {
  date: string;
  matching_picks_count: number;
  // add other properties as needed
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [BaseChartDirective],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  wins: any[] = [
    {
      date: '2025-02-17T00:00:00.000',
      historical_draw: ['04', '44', '47', '52', '57', '09'],
      matching_picks_count: 1,
      matching_picks: [['19', '27', '44', '52', '57', '17']],
      multiplier: '4',
    },
    {
      date: '2024-12-16T00:00:00.000',
      historical_draw: ['09', '30', '33', '57', '61', '17'],
      matching_picks_count: 1,
      matching_picks: [['19', '27', '44', '52', '57', '17']],
      multiplier: '2',
    },
    {
      date: '2024-10-28T00:00:00.000',
      historical_draw: ['21', '27', '32', '48', '67', '17'],
      matching_picks_count: 1,
      matching_picks: [['19', '27', '44', '52', '57', '17']],
      multiplier: '2',
    },
    {
      date: '2024-09-16T00:00:00.000',
      historical_draw: ['08', '09', '11', '27', '31', '17'],
      matching_picks_count: 1,
      matching_picks: [['19', '27', '44', '52', '57', '17']],
      multiplier: '5',
    },
    {
      date: '2024-09-14T00:00:00.000',
      historical_draw: ['29', '34', '38', '48', '56', '16'],
      matching_picks_count: 1,
      matching_picks: [['19', '29', '35', '36', '45', '16']],
      multiplier: '2',
    },
    {
      date: '2024-07-27T00:00:00.000',
      historical_draw: ['03', '31', '37', '40', '64', '17'],
      matching_picks_count: 1,
      matching_picks: [['03', '31', '37', '40', '64', '11']],
      multiplier: '3',
    },
    {
      date: '2024-06-03T00:00:00.000',
      historical_draw: ['19', '29', '35', '36', '45', '16'],
      matching_picks_count: 1,
      matching_picks: [['19', '29', '35', '36', '45', '16']],
      multiplier: '2',
    },
    {
      date: '2024-04-06T00:00:00.000',
      historical_draw: ['22', '27', '44', '52', '69', '09'],
      matching_picks_count: 1,
      matching_picks: [['19', '27', '44', '52', '57', '17']],
      multiplier: '3',
    },
    {
      date: '2024-03-09T00:00:00.000',
      historical_draw: ['30', '36', '49', '52', '63', '16'],
      matching_picks_count: 1,
      matching_picks: [['19', '29', '35', '36', '45', '16']],
      multiplier: '5',
    },
    {
      date: '2024-02-26T00:00:00.000',
      historical_draw: ['24', '29', '42', '51', '54', '16'],
      matching_picks_count: 1,
      matching_picks: [['19', '29', '35', '36', '45', '16']],
      multiplier: '3',
    },
    {
      date: '2024-01-10T00:00:00.000',
      historical_draw: ['25', '40', '43', '48', '50', '11'],
      matching_picks_count: 1,
      matching_picks: [['03', '31', '37', '40', '64', '11']],
      multiplier: '2',
    },
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
          // new Date(entry.date).toLocaleDateString()
          entry.month
        );
        const matchingPicks = this.wins.map((entry) => Number(entry.matching_picks_count));

        // Build the dataset compatible with Chart.js
        this.chartData = {
          labels: labels,
          datasets: [
            {
              label: 'Matching Picks Over Time',
              data: matchingPicks,
              borderColor: 'rgba(75, 192, 192, 1)',
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              fill: false,
              tension: 0.1,
            },
          ],
        };
      }
    );
  }
}
