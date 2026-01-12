import { Component, Input, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  PickDiffAnalysis,
  DiffPatternAnalysis,
  DiffPattern,
  BallDiff,
} from '../models/powerball-draw.interface';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-diff-analysis',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatChipsModule,
    MatIconModule,
  ],
  templateUrl: './diff-analysis.component.html',
  styleUrl: './diff-analysis.component.scss',
})
export class DiffAnalysisComponent implements OnInit, OnChanges {
  @Input() pickAnalyses: PickDiffAnalysis[] = [];
  @Input() patternAnalysis: DiffPatternAnalysis | null = null;

  // Summary statistics
  mostCommonDiffsByPosition: Map<number, DiffPattern> = new Map();
  totalPicks: number = 0;
  
  // Table data sources for each position
  positionPatternsData: Map<number, DiffPattern[]> = new Map();

  ngOnInit(): void {
    this.calculateSummaryStatistics();
  }

  ngOnChanges(): void {
    this.calculateSummaryStatistics();
  }

  /**
   * Calculates summary statistics from the pattern analysis
   */
  private calculateSummaryStatistics(): void {
    if (!this.patternAnalysis || !this.patternAnalysis.patterns) {
      return;
    }

    this.totalPicks = this.patternAnalysis.totalPicks;

    // Find most common diff for each position
    this.mostCommonDiffsByPosition.clear();
    const patternsByPosition = new Map<number, DiffPattern[]>();

    // Group patterns by position
    this.patternAnalysis.patterns.forEach((pattern) => {
      if (!patternsByPosition.has(pattern.position)) {
        patternsByPosition.set(pattern.position, []);
      }
      patternsByPosition.get(pattern.position)!.push(pattern);
    });

    // Find the pattern with highest frequency for each position
    patternsByPosition.forEach((patterns, position) => {
      const mostCommon = patterns.reduce((max, current) =>
        current.frequency > max.frequency ? current : max
      );
      this.mostCommonDiffsByPosition.set(position, mostCommon);
    });
  }

  /**
   * Gets the position name (e.g., "Position 1", "Powerball")
   */
  getPositionName(position: number): string {
    if (position === 5) {
      return 'Powerball';
    }
    return `Position ${position + 1}`;
  }

  /**
   * Gets the color class for a diff value
   */
  getDiffColorClass(diff: number): string {
    if (diff > 0) {
      return 'diff-positive';
    } else if (diff < 0) {
      return 'diff-negative';
    }
    return 'diff-zero';
  }

  /**
   * Gets patterns for a specific position
   */
  getPatternsForPosition(position: number): DiffPattern[] {
    if (!this.patternAnalysis || !this.patternAnalysis.patterns) {
      return [];
    }
    return this.patternAnalysis.patterns.filter((p) => p.position === position);
  }

  /**
   * Gets the most common diff for a position
   */
  getMostCommonDiffForPosition(position: number): DiffPattern | null {
    return this.mostCommonDiffsByPosition.get(position) || null;
  }

  /**
   * Formats a pick array for display
   */
  formatPick(pick: string[]): string {
    if (!pick || pick.length !== 6) {
      return '';
    }
    const whiteBalls = pick.slice(0, 5).join(' ');
    return `${whiteBalls} | ${pick[5]}`;
  }

  /**
   * Gets the ball diff for a specific position in a pick analysis
   */
  getBallDiff(analysis: PickDiffAnalysis, position: number): BallDiff | null {
    if (!analysis || !analysis.ballDiffs) {
      return null;
    }
    return analysis.ballDiffs.find((bd) => bd.position === position) || null;
  }
}
