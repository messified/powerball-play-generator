import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ToastrModule, ToastrService } from 'ngx-toastr';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DiffAnalysisComponent } from '../diff-analysis/diff-analysis.component';
import { DiffAnalysisService } from '../services/diff-analysis.service';
import { PowerballService } from '../services/powerball.service';
import { PowerballDataMinusLatest } from '../data/historical-data';
import { PowerballConfigService } from '../services/powerball-config.service';
import { AiPowerballService } from '../services/ai-powerball.service';
import {
  PickDiffAnalysis,
  DiffPatternAnalysis,
} from '../models/powerball-draw.interface';

@Component({
  selector: 'app-diff-analysis-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ToastrModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    DiffAnalysisComponent,
  ],
  providers: [provideAnimations()],
  templateUrl: './diff-analysis-page.component.html',
  styleUrl: './diff-analysis-page.component.scss',
})
export class DiffAnalysisPageComponent implements OnInit {
  loading = false;
  diffAnalyses: PickDiffAnalysis[] = [];
  diffPatternAnalysis: DiffPatternAnalysis | null = null;
  generatedPicks: string[][] = [];

  constructor(
    private diffAnalysisService: DiffAnalysisService,
    private powerballService: PowerballService,
    private configService: PowerballConfigService,
    private aiService: AiPowerballService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    // Optionally auto-generate on init
    // this.generateAndAnalyze();
  }

  async generateAndAnalyze(): Promise<void> {
    this.loading = true;
    this.diffAnalyses = [];
    this.diffPatternAnalysis = null;
    this.generatedPicks = [];

    try {
      // 1) Generate picks similar to play-generator
      const parsedDraws = this.parseDrawHistoryForModel(PowerballDataMinusLatest);

      if (!parsedDraws || parsedDraws.length === 0) {
        throw new Error('No historical data available');
      }

      // Generate legacy plays
      const counter = this.configService.get('generation').counter;
      const legacyPlays: string[][] = [];

      for (let i = 0; i < counter; i++) {
        try {
          const legacy = await this.powerballService.generatePowerballPlay();
          const legacyPlay: string[] = (
            legacy?.predictiveWeightedRandomPlay || []
          ).map((num: string) => (num.length === 1 ? `0${num}` : num));

          if (legacyPlay && legacyPlay.length === 6) {
            legacyPlays.push(legacyPlay);
          }
        } catch (error) {
          console.error(`Error generating legacy play ${i + 1}:`, error);
        }
      }

      // Generate ML tickets
      const seed = Date.now() % 1_000_000_000;
      const mlConfig = this.configService.get('mlGeneration');
      let batch;
      try {
        batch = await this.aiService.generateBatch(parsedDraws, {
          num_tickets: mlConfig.numTickets,
          diversity_min_hamming: mlConfig.diversityMinHamming,
          recency_decay: mlConfig.recencyDecay,
          alpha_smooth: mlConfig.alphaSmooth,
          temperature: mlConfig.temperature,
          seed,
        });
      } catch (error) {
        console.warn('ML batch generation failed, continuing with legacy plays only:', error);
        batch = null;
      }

      const mlTickets: string[][] = batch?.tickets?.map((t) => t.full_set) ?? [];
      const combined = [...mlTickets, ...legacyPlays];

      if (combined.length === 0) {
        throw new Error('No plays generated');
      }

      this.generatedPicks = combined;

      // 2) Perform diff analysis
      const latestDrawNumbers = await this.diffAnalysisService.getLatestDraw();
      if (latestDrawNumbers && latestDrawNumbers.length === 6 && combined.length > 0) {
        // Analyze picks against latest draw
        this.diffAnalyses = this.diffAnalysisService.analyzePicks(
          combined,
          latestDrawNumbers
        );

        // Identify patterns from the analyses
        this.diffPatternAnalysis = this.diffAnalysisService.identifyPatterns(
          this.diffAnalyses
        );

        console.log('Diff analysis completed:', {
          totalPicks: this.diffPatternAnalysis.totalPicks,
          patternsCount: this.diffPatternAnalysis.patterns.length,
          latestDraw: this.diffPatternAnalysis.latestDraw,
        });

        this.toastr.success(
          `Analyzed ${combined.length} picks`,
          'Diff Analysis Complete',
          {
            timeOut: 2000,
            positionClass: 'toast-bottom-right',
          }
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'An unknown error occurred while generating and analyzing picks';
      console.error('Error generating and analyzing picks:', error);
      this.toastr.error(errorMessage, 'Analysis Failed', {
        timeOut: 3000,
        positionClass: 'toast-bottom-right',
      });
    } finally {
      this.loading = false;
    }
  }

  /**
   * Converts raw historical draw data into a number[][] format
   * required by the AI prediction backend.
   */
  private parseDrawHistoryForModel(draws: any[]): number[][] {
    return draws.map((draw) => {
      const numbers = draw.winning_numbers
        .split(' ')
        .map((n: string) => parseInt(n, 10));
      return numbers;
    });
  }
}
