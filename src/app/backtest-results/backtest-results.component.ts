import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { BacktestService, BacktestResult, BacktestSummary, BacktestStepResult } from '../services/backtest.service';
import {
  BaseChartDirective,
  provideCharts,
  withDefaultRegisterables,
} from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartOptions } from 'chart.js';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';

interface StrategyCard {
  name: string;
  displayName: string;
  metrics: {
    averageWhiteHits: number;
    averagePowerballHits: number;
    perfectMatches: number;
    nearMisses: number;
    totalWhiteHits: number;
    totalPowerballHits: number;
    bestWhiteHits: number;
    worstWhiteHits: number;
    variance: number; // Range between best and worst
  };
  expanded: boolean;
}

interface QuickInsights {
  performanceComparison: string;
  varianceNote: string;
  rareEventSummary: string | null;
  consistencyIndicators: Array<{ strategy: string; variance: number; label: string }>;
}

interface MatchGroup {
  label: string; // e.g., "3 White + Powerball"
  key: string;    // e.g., "3W+PB"
  whiteHits: number;
  hasPowerball: boolean;
}

interface StrategyMatchGroups {
  strategy: string;
  groups: { [key: string]: number };
}

@Component({
  selector: 'app-backtest-results',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    BaseChartDirective,
    MatCardModule,
    MatTabsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatChipsModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatExpansionModule,
  ],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './backtest-results.component.html',
  styleUrl: './backtest-results.component.scss',
})
export class BacktestResultsComponent implements OnInit {
  backtestResult: BacktestResult | null = null;
  strategyCards: StrategyCard[] = [];
  loading = false;
  error: string | null = null;
  quickInsights: QuickInsights | null = null;

  // Configuration summary
  configSummary: {
    totalSteps: number;
    totalTestDraws: number;
    strategies: string[];
    dateRange: string;
  } | null = null;

  // Tier 2: Tabbed interface
  activeTab: 'overview' | 'performance' | 'consistency' | 'outcome' | 'efficiency' = 'overview';
  selectedTabIndex: number = 0;

  // Performance Over Time tab data
  timeSeriesChartData: ChartData<'line'> | null = null;
  timeSeriesChartOptions: ChartOptions<'line'> = {};
  distributionChartData: ChartData<'bar'> | null = null;
  distributionChartOptions: ChartOptions<'bar'> = {};
  dateRangeFilter: { start: string | null; end: string | null } = { start: null, end: null };
  dateRangeMin: string | null = null;
  dateRangeMax: string | null = null;

  // Consistency Analysis tab data
  consistencyChartData: ChartData<'bar'> | null = null;
  consistencyChartOptions: ChartOptions<'bar'> = {};
  varianceMetrics: Array<{ strategy: string; variance: number; stdDev: number }> = [];

  // Outcome Analysis tab data
  outcomeChartData: ChartData<'bar'> | null = null;
  outcomeChartOptions: ChartOptions<'bar'> = {};
  rareEventDetails: Array<{ strategy: string; perfectMatches: number; nearMisses: number; rates: { perfect: number; nearMiss: number } }> = [];
  matchGroupsByStrategy: StrategyMatchGroups[] = [];
  allMatchGroups: MatchGroup[] = [];

  // Efficiency Analysis tab data
  efficiencyScatterData: Array<{ x: number; y: number; strategy: string; label: string }> = [];
  efficiencyMetrics: Array<{ strategy: string; hitsPer100Tickets: number; totalTickets: number; totalHits: number }> = [];

  constructor(
    private backtestService: BacktestService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadBacktestResults();
  }

  async loadBacktestResults(): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      // Run backtest with default configuration
      // In a real app, this might come from a route parameter or service state
      const result = await this.backtestService.runBacktest({
        initialTrainingSize: 100,
        stepSize: 1,
        holdoutSize: 1,
        strategies: ['all', 'ensemble'], // Include ensemble strategy
        ticketsPerStrategy: 20,
        maxSteps: 50,
      });

      this.backtestResult = result;
      this.buildStrategyCards(result.summary);
      this.buildConfigSummary(result);
      this.buildQuickInsights(result);
      this.prepareTier2Data(result);
    } catch (err) {
      this.error =
        err instanceof Error
          ? err.message
          : 'An error occurred while loading backtest results';
      console.error('Error loading backtest results:', err);
    } finally {
      this.loading = false;
    }
  }

  private buildStrategyCards(summary: BacktestSummary): void {
    this.strategyCards = Object.keys(summary.strategies).map((strategyName) => {
      const metrics = summary.strategies[strategyName];
      const variance = metrics.bestWhiteHits - metrics.worstWhiteHits;
      return {
        name: strategyName,
        displayName: this.getStrategyDisplayName(strategyName),
        metrics: {
          averageWhiteHits: metrics.averageWhiteHits,
          averagePowerballHits: metrics.averagePowerballHits,
          perfectMatches: metrics.perfectMatches,
          nearMisses: metrics.nearMisses,
          totalWhiteHits: metrics.totalWhiteHits,
          totalPowerballHits: metrics.totalPowerballHits,
          bestWhiteHits: metrics.bestWhiteHits,
          worstWhiteHits: metrics.worstWhiteHits,
          variance: variance,
        },
        expanded: false,
      };
    });
  }

  private buildConfigSummary(result: BacktestResult): void {
    const stepResults = result.stepResults;
    const firstStep = stepResults[0];
    const lastStep = stepResults[stepResults.length - 1];

    this.configSummary = {
      totalSteps: result.summary.totalSteps,
      totalTestDraws: result.summary.overallMetrics.totalTestDraws,
      strategies: Object.keys(result.summary.strategies),
      dateRange: this.formatDateRange(
        firstStep?.testDraw.draw_date,
        lastStep?.testDraw.draw_date
      ),
    };
  }

  private formatDateRange(startDate: string | undefined, endDate: string | undefined): string {
    if (!startDate || !endDate) {
      return 'N/A';
    }
    const start = new Date(startDate).toLocaleDateString();
    const end = new Date(endDate).toLocaleDateString();
    return `${start} - ${end}`;
  }

  private getStrategyDisplayName(strategyName: string): string {
    const displayNames: { [key: string]: string } = {
      legacy: 'Legacy Strategy',
      prediction: 'Prediction Strategy',
      ai: 'AI Strategy',
      diffPattern: 'Diff Pattern Strategy',
      ensemble: 'Blended / Ensemble Strategy',
    };
    return displayNames[strategyName] || strategyName;
  }

  toggleCardExpansion(card: StrategyCard): void {
    card.expanded = !card.expanded;
  }

  exportToJson(): void {
    if (!this.backtestResult) {
      return;
    }
    const json = this.backtestService.exportToJson(this.backtestResult);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backtest-results-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  getStrategyColor(strategyName: string): string {
    const colors: { [key: string]: string } = {
      legacy: '#3b82f6', // blue
      prediction: '#10b981', // green
      ai: '#8b5cf6', // purple
      diffPattern: '#f59e0b', // amber
      ensemble: '#ec4899', // pink (to indicate composite)
    };
    return colors[strategyName] || '#6b7280'; // gray default
  }

  /**
   * Builds quick insights panel data based on backtest results.
   * Follows the plan's guidelines for honest, non-predictive framing.
   */
  private buildQuickInsights(result: BacktestResult): void {
    const totalTestDraws = result.summary.overallMetrics.totalTestDraws;
    const strategies = Object.keys(result.summary.strategies);
    const strategyNames = strategies.map((s) => this.getStrategyDisplayName(s));

    // Performance comparison insight
    const performanceComparison = `All strategies were tested against the same ${totalTestDraws} test draws. Differences shown here are from a limited sample and may be due to randomness, not strategy effectiveness.`;

    // Variance note
    const varianceNote = `Performance varies by draw. The averages shown represent outcomes across all test draws, but individual results can vary significantly.`;

    // Rare event summary
    let rareEventSummary: string | null = null;
    const perfectMatchCount = strategies.reduce(
      (sum, s) => sum + result.summary.strategies[s].perfectMatches,
      0
    );
    const nearMissCount = strategies.reduce(
      (sum, s) => sum + result.summary.strategies[s].nearMisses,
      0
    );

    if (perfectMatchCount > 0 || nearMissCount > 0) {
      rareEventSummary = `Perfect matches are extremely rare events (${perfectMatchCount} occurrence${perfectMatchCount !== 1 ? 's' : ''} in ${totalTestDraws} steps). Their occurrence in simulation does not indicate predictive capability.`;
    }

    // Consistency indicators (variance analysis)
    const consistencyIndicators = this.strategyCards.map((card) => {
      let label: string;
      if (card.metrics.variance <= 2) {
        label = 'Low variance';
      } else if (card.metrics.variance <= 3) {
        label = 'Moderate variance';
      } else {
        label = 'High variance';
      }

      return {
        strategy: card.displayName,
        variance: card.metrics.variance,
        label: label,
      };
    });

    this.quickInsights = {
      performanceComparison,
      varianceNote,
      rareEventSummary,
      consistencyIndicators,
    };
  }

  /**
   * Gets the variance description for a strategy card.
   */
  getVarianceDescription(variance: number): string {
    if (variance <= 2) {
      return 'Low variance (consistent outcomes)';
    } else if (variance <= 3) {
      return 'Moderate variance';
    } else {
      return 'High variance (wide range of outcomes)';
    }
  }

  /**
   * Calculates and returns the perfect match rate for display.
   */
  getPerfectMatchRate(perfectMatches: number, totalSteps: number): string {
    if (totalSteps === 0) return 'N/A';
    const rate = (perfectMatches / totalSteps) * 100;
    if (rate === 0) return '0%';
    return `${rate.toFixed(3)}%`;
  }

  /**
   * Gets the sample size context for display.
   */
  getSampleSizeContext(): string {
    if (!this.configSummary) return '';
    return `Based on ${this.configSummary.totalTestDraws} test draw${this.configSummary.totalTestDraws !== 1 ? 's' : ''}`;
  }

  /**
   * Checks if any strategy has perfect matches.
   */
  hasPerfectMatches(): boolean {
    return this.strategyCards.some((c) => c.metrics.perfectMatches > 0);
  }

  /**
   * Switches to a different tab in Tier 2.
   */
  switchTab(tab: 'overview' | 'performance' | 'consistency' | 'outcome' | 'efficiency'): void {
    this.activeTab = tab;
    const tabMap: { [key: string]: number } = {
      'overview': 0,
      'performance': 1,
      'consistency': 2,
      'outcome': 3,
      'efficiency': 4
    };
    this.selectedTabIndex = tabMap[tab] || 0;
  }

  /**
   * Handles tab change from mat-tab-group.
   */
  onTabChange(index: number): void {
    const tabMap: { [key: number]: 'overview' | 'performance' | 'consistency' | 'outcome' | 'efficiency' } = {
      0: 'overview',
      1: 'performance',
      2: 'consistency',
      3: 'outcome',
      4: 'efficiency'
    };
    const tab = tabMap[index];
    if (tab) {
      this.activeTab = tab;
      this.selectedTabIndex = index;
    }
  }

  /**
   * Prepares all data for Tier 2 detailed analysis views.
   */
  private prepareTier2Data(result: BacktestResult): void {
    // Set date range min/max for filter inputs
    if (result.stepResults.length > 0) {
      const dates = result.stepResults.map(s => new Date(s.testDraw.draw_date).getTime());
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      this.dateRangeMin = minDate.toISOString().split('T')[0];
      this.dateRangeMax = maxDate.toISOString().split('T')[0];
    }

    this.preparePerformanceOverTimeData(result);
    this.prepareConsistencyAnalysisData(result);
    this.prepareOutcomeAnalysisData(result);
    this.prepareEfficiencyAnalysisData(result);
  }

  /**
   * Prepares data for Performance Over Time tab.
   * Includes time-series chart and distribution charts.
   */
  private preparePerformanceOverTimeData(result: BacktestResult): void {
    const stepResults = this.getFilteredStepResults(result.stepResults);
    const strategies = Object.keys(result.summary.strategies);
    const strategyColors = strategies.map(s => this.getStrategyColor(s));

    // Time-series chart: white hits over time
    const labels = stepResults.map(step => 
      new Date(step.testDraw.draw_date).toLocaleDateString()
    );

    const datasets = strategies.map((strategy, index) => {
      const data = stepResults.map(step => {
        const prediction = step.predictions.find(p => p.strategy === strategy);
        return prediction ? prediction.bestMatch.whiteHits : 0;
      });

      // Add powerball hit markers (could be shown as points)
      const powerballData = stepResults.map(step => {
        const prediction = step.predictions.find(p => p.strategy === strategy);
        return prediction && prediction.bestMatch.powerballHit ? prediction.bestMatch.whiteHits : null;
      });

      return {
        label: this.getStrategyDisplayName(strategy),
        data: data,
        borderColor: strategyColors[index],
        backgroundColor: strategyColors[index] + '40',
        fill: false,
        tension: 0.1,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: powerballData.map((val, i) => 
          val !== null ? strategyColors[index] : 'transparent'
        ),
      };
    });

    this.timeSeriesChartData = {
      labels,
      datasets,
    };

    this.timeSeriesChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            boxWidth: 12,
            padding: 10,
            font: {
              size: 11,
            },
          },
        },
        title: {
          display: true,
          text: 'White Hits Over Time (Simulation)',
          font: {
            size: 14,
          },
        },
        tooltip: {
          enabled: true,
          padding: 8,
          titleFont: {
            size: 12,
          },
          bodyFont: {
            size: 11,
          },
          callbacks: {
            afterLabel: (context) => {
              const stepIndex = context.dataIndex;
              const step = stepResults[stepIndex];
              const strategy = strategies[context.datasetIndex];
              const prediction = step.predictions.find(p => p.strategy === strategy);
              if (prediction && prediction.bestMatch.powerballHit) {
                return 'Powerball: ✓';
              }
              return 'Powerball: ✗';
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 5,
          ticks: {
            stepSize: 1,
            font: {
              size: 10,
            },
          },
          title: {
            display: true,
            text: 'White Hits (0-5)',
            font: {
              size: 11,
            },
          },
        },
        x: {
          ticks: {
            font: {
              size: 10,
            },
            maxRotation: 45,
            minRotation: 0,
          },
          title: {
            display: true,
            text: 'Step Number (Chronological Order)',
            font: {
              size: 11,
            },
          },
        },
      },
    };

    // Distribution chart: frequency of white hit counts
    const distributionLabels = ['0', '1', '2', '3', '4', '5'];
    const distributionDatasets = strategies.map((strategy, index) => {
      const frequencies = [0, 0, 0, 0, 0, 0];
      stepResults.forEach(step => {
        const prediction = step.predictions.find(p => p.strategy === strategy);
        if (prediction) {
          frequencies[prediction.bestMatch.whiteHits]++;
        }
      });

      return {
        label: this.getStrategyDisplayName(strategy),
        data: frequencies,
        backgroundColor: strategyColors[index] + '80',
        borderColor: strategyColors[index],
        borderWidth: 1,
      };
    });

    this.distributionChartData = {
      labels: distributionLabels,
      datasets: distributionDatasets,
    };

    this.distributionChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            boxWidth: 12,
            padding: 10,
            font: {
              size: 11,
            },
          },
        },
        title: {
          display: true,
          text: 'White Hit Distribution Across Test Draws',
          font: {
            size: 14,
          },
        },
        tooltip: {
          enabled: true,
          padding: 8,
          titleFont: {
            size: 12,
          },
          bodyFont: {
            size: 11,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            font: {
              size: 10,
            },
          },
          title: {
            display: true,
            text: 'Frequency',
            font: {
              size: 11,
            },
          },
        },
        x: {
          ticks: {
            font: {
              size: 10,
            },
          },
          title: {
            display: true,
            text: 'White Hits',
            font: {
              size: 11,
            },
          },
        },
      },
    };
  }

  /**
   * Prepares data for Consistency Analysis tab.
   */
  private prepareConsistencyAnalysisData(result: BacktestResult): void {
    const stepResults = result.stepResults;
    const strategies = Object.keys(result.summary.strategies);
    const strategyColors = strategies.map(s => this.getStrategyColor(s));

    // Group steps into time windows (thirds)
    const windowSize = Math.ceil(stepResults.length / 3);
    const windows = [
      stepResults.slice(0, windowSize),
      stepResults.slice(windowSize, windowSize * 2),
      stepResults.slice(windowSize * 2),
    ].filter(w => w.length > 0);

    const windowLabels = windows.map((_, index) => {
      if (windows.length === 3) {
        return index === 0 ? 'First Third' : index === 1 ? 'Middle Third' : 'Last Third';
      }
      return `Window ${index + 1}`;
    });

    // Calculate hit rates per window per strategy
    const datasets = strategies.map((strategy, strategyIndex) => {
      const data = windows.map(window => {
        let totalHits = 0;
        let count = 0;
        window.forEach(step => {
          const prediction = step.predictions.find(p => p.strategy === strategy);
          if (prediction) {
            totalHits += prediction.bestMatch.whiteHits;
            count++;
          }
        });
        return count > 0 ? totalHits / count : 0;
      });

      return {
        label: this.getStrategyDisplayName(strategy),
        data: data,
        backgroundColor: strategyColors[strategyIndex] + '80',
        borderColor: strategyColors[strategyIndex],
        borderWidth: 1,
      };
    });

    this.consistencyChartData = {
      labels: windowLabels,
      datasets,
    };

    this.consistencyChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            boxWidth: 12,
            padding: 10,
            font: {
              size: 11,
            },
          },
        },
        title: {
          display: true,
          text: 'Hit Rate by Time Window (Arbitrary Grouping)',
          font: {
            size: 14,
          },
        },
        tooltip: {
          enabled: true,
          padding: 8,
          titleFont: {
            size: 12,
          },
          bodyFont: {
            size: 11,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 5,
          ticks: {
            font: {
              size: 10,
            },
          },
          title: {
            display: true,
            text: 'Average White Hits',
            font: {
              size: 11,
            },
          },
        },
        x: {
          ticks: {
            font: {
              size: 10,
            },
            maxRotation: 45,
            minRotation: 0,
          },
          title: {
            display: true,
            text: 'Time Window',
            font: {
              size: 11,
            },
          },
        },
      },
    };

    // Calculate variance metrics
    this.varianceMetrics = strategies.map(strategy => {
      const hits = stepResults
        .map(step => {
          const prediction = step.predictions.find(p => p.strategy === strategy);
          return prediction ? prediction.bestMatch.whiteHits : 0;
        })
        .filter(h => h !== undefined);

      const mean = hits.reduce((a, b) => a + b, 0) / hits.length;
      const variance = hits.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) / hits.length;
      const stdDev = Math.sqrt(variance);

      return {
        strategy: this.getStrategyDisplayName(strategy),
        variance: variance,
        stdDev: stdDev,
      };
    });
  }

  /**
   * Gets a formatted label for a match combination.
   */
  private getMatchGroupLabel(whiteHits: number, hasPowerball: boolean): string {
    if (whiteHits === 0) {
      return hasPowerball ? 'Powerball Only' : 'No Matches';
    }
    const whiteLabel = whiteHits === 1 ? '1 White' : `${whiteHits} White${whiteHits > 1 ? 's' : ''}`;
    if (hasPowerball) {
      return `${whiteLabel} + Powerball`;
    }
    return `${whiteLabel} (no Powerball)`;
  }

  /**
   * Gets a key for a match combination.
   */
  private getMatchGroupKey(whiteHits: number, hasPowerball: boolean): string {
    return `${whiteHits}W${hasPowerball ? '+PB' : ''}`;
  }

  /**
   * Initializes all possible match groups.
   */
  private initializeAllMatchGroups(): MatchGroup[] {
    const groups: MatchGroup[] = [];
    for (let whiteHits = 0; whiteHits <= 5; whiteHits++) {
      groups.push({
        label: this.getMatchGroupLabel(whiteHits, false),
        key: this.getMatchGroupKey(whiteHits, false),
        whiteHits,
        hasPowerball: false,
      });
      groups.push({
        label: this.getMatchGroupLabel(whiteHits, true),
        key: this.getMatchGroupKey(whiteHits, true),
        whiteHits,
        hasPowerball: true,
      });
    }
    return groups;
  }

  /**
   * Prepares data for Outcome Analysis tab.
   */
  private prepareOutcomeAnalysisData(result: BacktestResult): void {
    const strategies = Object.keys(result.summary.strategies);
    const strategyColors = strategies.map(s => this.getStrategyColor(s));
    const totalSteps = result.summary.totalSteps;

    // Initialize all possible match groups
    this.allMatchGroups = this.initializeAllMatchGroups();

    // Initialize match groups for each strategy
    const matchGroupsMap: { [strategy: string]: { [key: string]: number } } = {};
    strategies.forEach(strategy => {
      matchGroupsMap[strategy] = {};
      this.allMatchGroups.forEach(group => {
        matchGroupsMap[strategy][group.key] = 0;
      });
    });

    // Count matches for each strategy
    result.stepResults.forEach(step => {
      step.predictions.forEach(pred => {
        const match = pred.bestMatch;
        const key = this.getMatchGroupKey(match.whiteHits, match.powerballHit);
        if (matchGroupsMap[pred.strategy] && matchGroupsMap[pred.strategy][key] !== undefined) {
          matchGroupsMap[pred.strategy][key]++;
        }
      });
    });

    // Convert to array format
    this.matchGroupsByStrategy = strategies.map(strategy => ({
      strategy: this.getStrategyDisplayName(strategy),
      groups: matchGroupsMap[strategy],
    }));

    // Get all unique combinations that have at least one match across all strategies
    const activeGroups = this.allMatchGroups.filter(group => {
      return strategies.some(strategy => {
        const key = group.key;
        return matchGroupsMap[strategy][key] > 0;
      });
    });

    // Sort by white hits (ascending), then by powerball (false first)
    activeGroups.sort((a, b) => {
      if (a.whiteHits !== b.whiteHits) {
        return a.whiteHits - b.whiteHits;
      }
      return a.hasPowerball === b.hasPowerball ? 0 : a.hasPowerball ? 1 : -1;
    });

    // Prepare chart data with grouped bars
    const chartLabels = activeGroups.map(g => g.label);
    const datasets = strategies.map((strategy, index) => {
      const data = activeGroups.map(group => {
        return matchGroupsMap[strategy][group.key] || 0;
      });

      return {
        label: this.getStrategyDisplayName(strategy),
        data: data,
        backgroundColor: strategyColors[index] + '80',
        borderColor: strategyColors[index],
        borderWidth: 1,
      };
    });

    this.outcomeChartData = {
      labels: chartLabels,
      datasets: datasets,
    };

    this.outcomeChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            boxWidth: 12,
            padding: 10,
            font: {
              size: 11,
            },
          },
        },
        title: {
          display: true,
          text: 'Match Groups by Combination',
          font: {
            size: 14,
          },
        },
        tooltip: {
          enabled: true,
          padding: 8,
          titleFont: {
            size: 12,
          },
          bodyFont: {
            size: 11,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            font: {
              size: 10,
            },
          },
          title: {
            display: true,
            text: 'Count',
            font: {
              size: 11,
            },
          },
        },
        x: {
          ticks: {
            font: {
              size: 10,
            },
            maxRotation: 45,
            minRotation: 45,
          },
          title: {
            display: true,
            text: 'Match Combination',
            font: {
              size: 11,
            },
          },
        },
      },
    };

    // Rare event details (keep for backward compatibility)
    this.rareEventDetails = strategies.map(strategy => {
      const metrics = result.summary.strategies[strategy];
      return {
        strategy: this.getStrategyDisplayName(strategy),
        perfectMatches: metrics.perfectMatches,
        nearMisses: metrics.nearMisses,
        rates: {
          perfect: totalSteps > 0 ? (metrics.perfectMatches / totalSteps) * 100 : 0,
          nearMiss: totalSteps > 0 ? (metrics.nearMisses / totalSteps) * 100 : 0,
        },
      };
    });
  }

  /**
   * Prepares data for Efficiency Analysis tab.
   */
  private prepareEfficiencyAnalysisData(result: BacktestResult): void {
    const strategies = Object.keys(result.summary.strategies);
    const stepResults = result.stepResults;

    // Calculate efficiency metrics
    this.efficiencyMetrics = strategies.map(strategy => {
      let totalTickets = 0;
      let totalHits = 0;

      stepResults.forEach(step => {
        const prediction = step.predictions.find(p => p.strategy === strategy);
        if (prediction) {
          totalTickets += prediction.tickets.length;
          totalHits += prediction.bestMatch.whiteHits;
        }
      });

      const hitsPer100Tickets = totalTickets > 0 ? (totalHits / totalTickets) * 100 : 0;

      return {
        strategy: this.getStrategyDisplayName(strategy),
        hitsPer100Tickets: hitsPer100Tickets,
        totalTickets: totalTickets,
        totalHits: totalHits,
      };
    });

    // Scatter plot data: tickets per step vs average hits per step
    this.efficiencyScatterData = strategies.flatMap(strategy => {
      const strategyColor = this.getStrategyColor(strategy);
      const stepAverages = stepResults.map(step => {
        const prediction = step.predictions.find(p => p.strategy === strategy);
        if (prediction) {
          return {
            tickets: prediction.tickets.length,
            hits: prediction.bestMatch.whiteHits,
          };
        }
        return { tickets: 0, hits: 0 };
      });

      // Group by ticket count ranges and calculate average hits
      const grouped: { [ticketRange: string]: number[] } = {};
      stepAverages.forEach(avg => {
        const range = `${Math.floor(avg.tickets / 5) * 5}-${Math.floor(avg.tickets / 5) * 5 + 4}`;
        if (!grouped[range]) grouped[range] = [];
        grouped[range].push(avg.hits);
      });

      return Object.entries(grouped).map(([range, hits]) => {
        const avgHits = hits.reduce((a, b) => a + b, 0) / hits.length;
        const ticketCount = parseInt(range.split('-')[0]) + 2;
        return {
          x: ticketCount,
          y: avgHits,
          strategy: this.getStrategyDisplayName(strategy),
          label: `${range} tickets`,
        };
      });
    });
  }

  /**
   * Gets filtered step results based on date range filter.
   */
  private getFilteredStepResults(stepResults: BacktestStepResult[]): BacktestStepResult[] {
    if (!this.dateRangeFilter.start && !this.dateRangeFilter.end) {
      return stepResults;
    }

    return stepResults.filter(step => {
      const stepDate = new Date(step.testDraw.draw_date);
      if (this.dateRangeFilter.start && stepDate < new Date(this.dateRangeFilter.start)) {
        return false;
      }
      if (this.dateRangeFilter.end && stepDate > new Date(this.dateRangeFilter.end)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Updates date range filter and refreshes performance charts.
   */
  updateDateRangeFilter(): void {
    if (this.backtestResult) {
      this.preparePerformanceOverTimeData(this.backtestResult);
    }
  }

  /**
   * Clears date range filter.
   */
  clearDateRangeFilter(): void {
    this.dateRangeFilter = { start: null, end: null };
    if (this.backtestResult) {
      this.preparePerformanceOverTimeData(this.backtestResult);
    }
  }

  /**
   * Navigates to step-by-step inspection view.
   * Optionally navigates to a specific step.
   */
  goToStepInspection(stepNumber?: number): void {
    if (stepNumber !== undefined) {
      this.router.navigate(['/backtest/inspect'], { queryParams: { step: stepNumber } });
    } else {
      this.router.navigate(['/backtest/inspect']);
    }
  }
}
