import { Component, OnInit, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { BacktestService, BacktestResult, BacktestStepResult } from '../../services/backtest.service';

interface StepListItem {
  step: number;
  date: string;
  trainingSize: number;
  hasPerfectMatch: boolean;
  hasNearMiss: boolean;
  bestWhiteHits: number;
  strategies: string[];
}

@Component({
  selector: 'app-step-inspection',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './step-inspection.component.html',
  styleUrl: './step-inspection.component.scss',
})
export class StepInspectionComponent implements OnInit, OnChanges {
  @Input() backtestResult: BacktestResult | null = null;
  @Input() initialStep: number | null = null;

  currentStepIndex: number = 0;
  currentStep: BacktestStepResult | null = null;
  stepList: StepListItem[] = [];
  loading = false;
  error: string | null = null;
  
  // Cached formatted numbers for current step (for template efficiency)
  private _formattedActualNumbers: string[] = [];
  private _formattedActualWhiteNumbers: string[] = [];
  private _formattedActualPowerballNumbers: string[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private backtestService: BacktestService
  ) {}

  ngOnInit(): void {
    // If no backtest result yet, try to load from service
    // In a real app, this might come from a service or route resolver
    if (!this.backtestResult) {
      this.loadBacktestResults();
    } else {
      this.initializeStepList();
      this.initializeCurrentStep();
      this.checkRouteParams();
    }

    // Subscribe to route parameter changes
    this.route.queryParams.subscribe((params) => {
      const stepParam = params['step'];
      if (stepParam !== undefined && this.backtestResult) {
        const stepNum = parseInt(stepParam, 10);
        if (!isNaN(stepNum)) {
          this.goToStep(stepNum);
        }
      }
    });
  }

  private checkRouteParams(): void {
    const params = this.route.snapshot.queryParams;
    const stepParam = params['step'];
    if (stepParam !== undefined && this.backtestResult) {
      const stepNum = parseInt(stepParam, 10);
      if (!isNaN(stepNum)) {
        this.goToStep(stepNum);
      }
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['backtestResult'] && this.backtestResult) {
      this.initializeStepList();
      this.initializeCurrentStep();
    }
    if (changes['initialStep'] && this.initialStep !== null && this.backtestResult) {
      this.goToStep(this.initialStep);
    }
  }

  async loadBacktestResults(): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      const result = await this.backtestService.runBacktest({
        initialTrainingSize: 100,
        stepSize: 1,
        holdoutSize: 1,
        strategies: ['all', 'ensemble'],
        ticketsPerStrategy: 20,
        maxSteps: 50,
      });

      this.backtestResult = result;
      this.initializeStepList();
      this.initializeCurrentStep();
      // After loading, check for route parameters
      this.checkRouteParams();
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

  private initializeStepList(): void {
    if (!this.backtestResult) return;

    this.stepList = this.backtestResult.stepResults.map((stepResult) => {
      // Check for perfect matches (5 white + powerball)
      const hasPerfectMatch = stepResult.predictions.some(
        (pred) => pred.bestMatch.whiteHits === 5 && pred.bestMatch.powerballHit
      );

      // Check for near misses (4 white + powerball or 5 white)
      const hasNearMiss = stepResult.predictions.some(
        (pred) =>
          (pred.bestMatch.whiteHits === 4 && pred.bestMatch.powerballHit) ||
          pred.bestMatch.whiteHits === 5
      );

      // Get best white hits across all strategies
      const bestWhiteHits = Math.max(
        ...stepResult.predictions.map((pred) => pred.bestMatch.whiteHits)
      );

      return {
        step: stepResult.step,
        date: stepResult.testDraw.draw_date,
        trainingSize: stepResult.trainingSize,
        hasPerfectMatch,
        hasNearMiss,
        bestWhiteHits,
        strategies: stepResult.predictions.map((pred) => pred.strategy),
      };
    });
    
    // Reverse the list to show most recent steps first (highest step numbers first)
    this.stepList.reverse();
  }

  private initializeCurrentStep(): void {
    if (!this.backtestResult || this.backtestResult.stepResults.length === 0) {
      return;
    }

    // Use initialStep if provided, otherwise default to first step
    const targetStep = this.initialStep !== null ? this.initialStep : 0;
    const stepIndex = this.backtestResult.stepResults.findIndex((s) => s.step === targetStep);
    
    if (stepIndex >= 0) {
      this.currentStepIndex = stepIndex;
      this.currentStep = this.backtestResult.stepResults[stepIndex];
    } else {
      this.currentStepIndex = 0;
      this.currentStep = this.backtestResult.stepResults[0];
    }
    
    // Cache formatted numbers for template efficiency
    this.updateFormattedNumbers();
  }

  goToStep(stepNumber: number): void {
    if (!this.backtestResult) return;

    const stepIndex = this.backtestResult.stepResults.findIndex((s) => s.step === stepNumber);
    if (stepIndex >= 0) {
      this.currentStepIndex = stepIndex;
      this.currentStep = this.backtestResult.stepResults[stepIndex];
      
      // Cache formatted numbers for template efficiency
      this.updateFormattedNumbers();
      
      // Update URL without reloading
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { step: stepNumber },
        queryParamsHandling: 'merge',
      });
    }
  }

  goToStepByIndex(index: number): void {
    if (!this.backtestResult || index < 0 || index >= this.backtestResult.stepResults.length) {
      return;
    }

    this.currentStepIndex = index;
    this.currentStep = this.backtestResult.stepResults[index];
    const stepNumber = this.currentStep.step;
    
    // Cache formatted numbers for template efficiency
    this.updateFormattedNumbers();
    
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step: stepNumber },
      queryParamsHandling: 'merge',
    });
  }

  private updateFormattedNumbers(): void {
    if (!this.currentStep) {
      this._formattedActualNumbers = [];
      this._formattedActualWhiteNumbers = [];
      this._formattedActualPowerballNumbers = [];
      return;
    }

    this._formattedActualNumbers = this.formatNumbers(this.currentStep.testDraw.winning_numbers);
    this._formattedActualWhiteNumbers = this._formattedActualNumbers.slice(0, 5);
    this._formattedActualPowerballNumbers = this._formattedActualNumbers.slice(5);
  }

  getFormattedActualWhiteNumbers(): string[] {
    return this._formattedActualWhiteNumbers;
  }

  getFormattedActualPowerballNumbers(): string[] {
    return this._formattedActualPowerballNumbers;
  }

  previousStep(): void {
    // Since steps are displayed reversed (most recent first),
    // "Previous" means going to a newer step (higher index in original array)
    if (!this.backtestResult) return;
    if (this.currentStepIndex < this.backtestResult.stepResults.length - 1) {
      this.goToStepByIndex(this.currentStepIndex + 1);
    }
  }

  nextStep(): void {
    // Since steps are displayed reversed (most recent first),
    // "Next" means going to an older step (lower index in original array)
    if (this.currentStepIndex > 0) {
      this.goToStepByIndex(this.currentStepIndex - 1);
    }
  }

  jumpToStep(): void {
    const input = prompt(`Enter step number (0-${this.stepList.length - 1}):`);
    if (input !== null) {
      const stepNum = parseInt(input, 10);
      if (!isNaN(stepNum) && stepNum >= 0 && stepNum < this.stepList.length) {
        this.goToStep(stepNum);
      } else {
        alert(`Invalid step number. Please enter a number between 0 and ${this.stepList.length - 1}.`);
      }
    }
  }

  exportStepData(): void {
    if (!this.currentStep) return;

    const stepData = {
      step: this.currentStep.step,
      trainingSize: this.currentStep.trainingSize,
      testDraw: this.currentStep.testDraw,
      predictions: this.currentStep.predictions,
      timestamp: this.currentStep.timestamp,
    };

    const json = JSON.stringify(stepData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backtest-step-${this.currentStep.step}-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  formatNumbers(numbers: string): string[] {
    return numbers.split(' ');
  }

  getStrategyDisplayName(strategyName: string): string {
    const displayNames: { [key: string]: string } = {
      legacy: 'Legacy Strategy',
      prediction: 'Prediction Strategy',
      ai: 'AI Strategy',
      diffPattern: 'Diff Pattern Strategy',
      ensemble: 'Blended / Ensemble Strategy',
    };
    return displayNames[strategyName] || strategyName;
  }

  getStrategyColor(strategyName: string): string {
    const colors: { [key: string]: string } = {
      legacy: '#3b82f6', // blue
      prediction: '#10b981', // green
      ai: '#8b5cf6', // purple
      diffPattern: '#f59e0b', // amber
      ensemble: '#ec4899', // pink
    };
    return colors[strategyName] || '#6b7280'; // gray default
  }

  isStepHighlighted(stepItem: StepListItem): boolean {
    if (!this.currentStep) return false;
    return stepItem.step === this.currentStep.step;
  }

  canGoPrevious(): boolean {
    // Since steps are displayed reversed (most recent first),
    // "Previous" means going to a newer step (higher index)
    if (!this.backtestResult) return false;
    return this.currentStepIndex < this.backtestResult.stepResults.length - 1;
  }

  canGoNext(): boolean {
    // Since steps are displayed reversed (most recent first),
    // "Next" means going to an older step (lower index)
    return this.currentStepIndex > 0;
  }

  getHighlightClass(stepItem: StepListItem): string {
    if (stepItem.hasPerfectMatch) return 'perfect-match';
    if (stepItem.hasNearMiss) return 'near-miss';
    return '';
  }

  getTotalSteps(): number {
    return this.backtestResult?.stepResults.length || 0;
  }

  getCurrentStepNumber(): number {
    return this.currentStep?.step ?? 0;
  }

  isNumberMatched(num: string, actualNumbers: string[]): boolean {
    return actualNumbers.includes(num);
  }

  // Portfolio metrics helpers for ensemble strategy
  getEnsembleUniqueWhites(tickets: string[][]): number {
    if (!tickets || tickets.length === 0) return 0;
    const uniqueWhites = new Set<string>();
    tickets.forEach(ticket => {
      // First 5 numbers are white numbers
      ticket.slice(0, 5).forEach(num => uniqueWhites.add(num));
    });
    return uniqueWhites.size;
  }

  getEnsembleCoverage(tickets: string[][]): number {
    const uniqueWhites = this.getEnsembleUniqueWhites(tickets);
    return (uniqueWhites / 69) * 100; // Returns percentage
  }

  getEnsembleMaxReuse(tickets: string[][]): number {
    if (!tickets || tickets.length === 0) return 0;
    const whiteNumberCounts: { [key: string]: number } = {};
    tickets.forEach(ticket => {
      ticket.slice(0, 5).forEach(num => {
        whiteNumberCounts[num] = (whiteNumberCounts[num] || 0) + 1;
      });
    });
    return Math.max(...Object.values(whiteNumberCounts), 0);
  }

  // Strategy contributions calculation
  getStrategyContributions(prediction: { strategy: string; tickets: string[][]; bestMatch: { matchedTicket: string[] } }, allPredictions: { strategy: string; tickets: string[][]; bestMatch: { matchedTicket: string[] } }[]): Array<{ strategy: string; count: number; percentage: number }> {
    if (prediction.strategy !== 'ensemble' || !prediction.bestMatch.matchedTicket || prediction.bestMatch.matchedTicket.length < 5) {
      return [];
    }

    const bestMatchWhites = prediction.bestMatch.matchedTicket.slice(0, 5);
    const baseStrategies = ['legacy', 'prediction', 'ai', 'diffPattern'];
    const contributions: Array<{ strategy: string; count: number; percentage: number }> = [];

    baseStrategies.forEach(baseStrategy => {
      const basePrediction = allPredictions.find(p => p.strategy === baseStrategy);
      if (!basePrediction || !basePrediction.tickets || basePrediction.tickets.length === 0) {
        return;
      }

      // Calculate top-K most frequent numbers from base strategy tickets
      const whiteNumberCounts: { [key: string]: number } = {};
      basePrediction.tickets.forEach(ticket => {
        ticket.slice(0, 5).forEach(num => {
          whiteNumberCounts[num] = (whiteNumberCounts[num] || 0) + 1;
        });
      });

      // Get top-K numbers (K = number of tickets, but we'll use top 20 to be safe)
      const sortedNumbers = Object.entries(whiteNumberCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, Math.min(20, basePrediction.tickets.length))
        .map(entry => entry[0]);

      // Count how many numbers from best match appear in top-K
      const contributionCount = bestMatchWhites.filter(num => sortedNumbers.includes(num)).length;
      const percentage = bestMatchWhites.length > 0 ? (contributionCount / bestMatchWhites.length) * 100 : 0;

      if (contributionCount > 0) {
        contributions.push({
          strategy: baseStrategy,
          count: contributionCount,
          percentage: percentage
        });
      }
    });

    return contributions.sort((a, b) => b.percentage - a.percentage);
  }

  isEnsembleStrategy(strategy: string): boolean {
    return strategy === 'ensemble';
  }

  goToOverview(): void {
    this.router.navigate(['/backtest']);
  }
}
