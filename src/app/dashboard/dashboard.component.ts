import { Component, OnInit } from '@angular/core';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';

interface Win {
  date: string;
  matching_picks_count: number;
  // add other properties as needed
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
}) 
export class DashboardComponent implements OnInit {
  wins: Win[] = []; // This would come from your data service or JSON

  // Chart options and data for a bar chart
  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
  };
  public barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Matching Picks Count',
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      }
    ]
  };
  public barChartType: ChartType = 'bar';

  constructor() { }

  ngOnInit(): void {
    // For demo purposes, you might assign some sample wins.
    // In your app, you could inject a service to get this data.
    this.wins = [
      { date: '2025-02-26T22:48:04.065Z', matching_picks_count: 3 },
      { date: '2025-02-28T22:48:04.065Z', matching_picks_count: 2 },
      { date: '2025-03-02T22:48:04.065Z', matching_picks_count: 6 },
      // ... more wins from your JSON
    ];

    // Prepare chart labels and data from wins
    this.barChartData.labels = this.wins.map(win => new Date(win.date).toLocaleDateString());
    this.barChartData.datasets[0].data = this.wins.map(win => win.matching_picks_count);
  }
}

