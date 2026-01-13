import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { ToastrModule, ToastrService } from 'ngx-toastr';
import { DiffAnalysisService } from '../services/diff-analysis.service';
import { PickCheckerService } from '../services/pick-checker.service';
import {
  LatestDrawMatchResult,
  PickMatchResult,
  PickDiffAnalysis,
  DiffPatternAnalysis,
  DiffPattern,
  CheckPicksResult,
} from '../models/powerball-draw.interface';

@Component({
  selector: 'app-paste-plays-checker',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ToastrModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
  ],
  templateUrl: './paste-plays-checker.component.html',
  styleUrl: './paste-plays-checker.component.scss',
})
export class PastePlaysCheckerComponent implements OnInit {
  pastedText: string = '';
  parsedPicks: string[][] = [];
  latestDrawMatchResult: LatestDrawMatchResult | null = null;
  diffAnalyses: PickDiffAnalysis[] = [];
  diffPatternAnalysis: DiffPatternAnalysis | null = null;
  historicalCheckResult: CheckPicksResult | null = null;
  loading = false;
  checkingHistorical = false;
  showDiffAnalysis = false;
  showHistoricalResults = false;

  displayedColumns: string[] = ['pick', 'whiteMatches', 'powerballMatch', 'matchTier'];

  constructor(
    private diffAnalysisService: DiffAnalysisService,
    private pickCheckerService: PickCheckerService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    // Component initialization
  }

  /**
   * Parses pasted text into array of plays
   */
  parsePastedPlays(text: string): string[][] {
    const lines = text.trim().split('\n');
    const plays: string[][] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue; // Skip empty lines

      const numbers = trimmedLine.split(/\s+/);
      if (numbers.length === 6) {
        const normalized = numbers.map((n) => {
          const num = parseInt(n, 10);
          if (isNaN(num)) return null;
          return num.toString().padStart(2, '0');
        });

        if (normalized.every((n) => n !== null)) {
          plays.push(normalized as string[]);
        }
      }
    }

    return plays;
  }

  /**
   * Determines match tier based on white matches and powerball match
   */
  getMatchTier(whiteMatches: number, powerballMatch: boolean): string {
    if (whiteMatches === 5 && powerballMatch) {
      return '5+PB';
    } else if (whiteMatches === 5) {
      return '5 White';
    } else if (whiteMatches === 4 && powerballMatch) {
      return '4+PB';
    } else if (whiteMatches === 4) {
      return '4 White';
    } else if (whiteMatches === 3 && powerballMatch) {
      return '3+PB';
    } else if (whiteMatches === 3) {
      return '3 White';
    } else if (whiteMatches === 2 && powerballMatch) {
      return '2+PB';
    } else if (whiteMatches === 2) {
      return '2 White';
    } else if (whiteMatches === 1 && powerballMatch) {
      return '1+PB';
    } else if (whiteMatches === 1) {
      return '1 White';
    } else if (powerballMatch) {
      return 'Powerball Only';
    } else {
      return 'No Match';
    }
  }

  /**
   * Checks picks against latest draw
   */
  async checkPicksAgainstLatestDraw(picks: string[][]): Promise<LatestDrawMatchResult> {
    const latestDraw = await this.diffAnalysisService.getLatestDraw();
    const latestDrawData = await this.getLatestDrawData();

    const matches: PickMatchResult[] = [];
    const summary: { [tier: string]: number } = {};

    // Create a set for quick lookup of white balls
    const whiteBallsSet = new Set(latestDraw.slice(0, 5));
    const powerballValue = latestDraw[5];

    for (const pick of picks) {
      let whiteMatches = 0;

      // Count white ball matches (positions 0-4)
      for (let i = 0; i < 5; i++) {
        if (whiteBallsSet.has(pick[i])) {
          whiteMatches++;
        }
      }

      // Check powerball match (position 5)
      const powerballMatch = pick[5] === powerballValue;

      const matchTier = this.getMatchTier(whiteMatches, powerballMatch);

      matches.push({
        pick,
        whiteMatches,
        powerballMatch,
        matchTier,
      });

      // Update summary
      summary[matchTier] = (summary[matchTier] || 0) + 1;
    }

    return {
      latestDraw,
      latestDrawDate: latestDrawData.draw_date,
      latestDrawMultiplier: latestDrawData.multiplier,
      totalPicks: picks.length,
      matches,
      summary,
    };
  }

  /**
   * Gets latest draw data including date and multiplier
   */
  private async getLatestDrawData(): Promise<{
    draw_date: string;
    winning_numbers: string;
    multiplier: string;
  }> {
    // Use dynamic import to avoid circular dependencies
    const powerballDataModule = await import('../data/powerball-data');
    const PowerballData = powerballDataModule.PowerballData;
    if (!PowerballData || PowerballData.length === 0) {
      throw new Error('PowerballData is empty or not available');
    }
    return PowerballData[0];
  }

  /**
   * Formats a pick array for display
   */
  formatPick(pick: string[]): string {
    if (!pick || pick.length !== 6) return '';
    return `${pick.slice(0, 5).join(' ')} ${pick[5]}`;
  }

  /**
   * Handles the check button click
   */
  async onCheckLatestDraw(): Promise<void> {
    if (!this.pastedText.trim()) {
      this.toastr.warning('Please paste some plays to check');
      return;
    }

    this.loading = true;
    try {
      // Parse the pasted text
      this.parsedPicks = this.parsePastedPlays(this.pastedText);

      if (this.parsedPicks.length === 0) {
        this.toastr.error('No valid plays found. Please ensure each line has 6 numbers.');
        this.loading = false;
        return;
      }

      // Check against latest draw
      this.latestDrawMatchResult = await this.checkPicksAgainstLatestDraw(
        this.parsedPicks
      );

      // Perform diff analysis
      const latestDraw = await this.diffAnalysisService.getLatestDraw();
      this.diffAnalyses = this.diffAnalysisService.analyzePicks(
        this.parsedPicks,
        latestDraw
      );
      this.diffPatternAnalysis = this.diffAnalysisService.identifyPatterns(
        this.diffAnalyses
      );
      this.showDiffAnalysis = true;

      this.toastr.success(
        `Checked ${this.parsedPicks.length} plays against latest draw`
      );
    } catch (error) {
      console.error('Error checking plays:', error);
      this.toastr.error('Error checking plays. Please try again.');
    } finally {
      this.loading = false;
    }
  }

  /**
   * Checks picks against all historical draws
   */
  async onCheckHistorical(): Promise<void> {
    if (this.parsedPicks.length === 0) {
      this.toastr.warning('Please check against latest draw first');
      return;
    }

    this.checkingHistorical = true;
    try {
      this.historicalCheckResult = this.pickCheckerService.checkPicks(
        this.parsedPicks
      );
      this.showHistoricalResults = true;
      this.toastr.success('Historical analysis complete');
    } catch (error) {
      console.error('Error checking historical:', error);
      this.toastr.error('Error checking historical draws. Please try again.');
    } finally {
      this.checkingHistorical = false;
    }
  }

  /**
   * Clears all results
   */
  clearResults(): void {
    this.pastedText = '';
    this.parsedPicks = [];
    this.latestDrawMatchResult = null;
    this.diffAnalyses = [];
    this.diffPatternAnalysis = null;
    this.historicalCheckResult = null;
    this.showDiffAnalysis = false;
    this.showHistoricalResults = false;
  }

  /**
   * Gets tier color for display
   */
  getTierColor(tier: string): string {
    if (tier === '5+PB') return 'primary';
    if (tier === '5 White' || tier === '4+PB') return 'accent';
    if (tier === '4 White' || tier === '3+PB') return 'warn';
    return '';
  }

  /**
   * Gets keys from summary object for iteration
   */
  getTierKeys(summary: { [tier: string]: number }): string[] {
    return Object.keys(summary).filter((key) => summary[key] > 0);
  }

  /**
   * Gets filtered matches (3+ white balls only)
   */
  getFilteredMatches(): PickMatchResult[] {
    if (!this.latestDrawMatchResult) return [];
    return this.latestDrawMatchResult.matches.filter(
      (m) => m.whiteMatches >= 3
    );
  }

  /**
   * Gets filtered summary based on matches with 3+ white balls
   */
  getFilteredSummary(): { [tier: string]: number } {
    if (!this.latestDrawMatchResult) return {};
    const filteredMatches = this.getFilteredMatches();
    const summary: { [tier: string]: number } = {};
    
    filteredMatches.forEach((match) => {
      summary[match.matchTier] = (summary[match.matchTier] || 0) + 1;
    });
    
    return summary;
  }

  /**
   * Gets count of matches (3+ white balls only)
   */
  getMatchCount(): number {
    if (!this.latestDrawMatchResult) return 0;
    return this.latestDrawMatchResult.matches.filter(
      (m) => m.whiteMatches >= 3
    ).length;
  }

  /**
   * Gets patterns for a specific position
   */
  getPatternsForPosition(position: number): DiffPattern[] {
    if (!this.diffPatternAnalysis || !this.diffPatternAnalysis.patterns) {
      return [];
    }
    return this.diffPatternAnalysis.patterns.filter(p => p.position === position);
  }

  /**
   * Gets the position name for display
   */
  getPositionName(position: number): string {
    if (position === 5) {
      return 'Powerball';
    }
    return `Position ${position + 1}`;
  }
}
