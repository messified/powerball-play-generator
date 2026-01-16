import { Component, OnInit } from '@angular/core';
import { PowerballService } from '../services/powerball.service';
import { ToastrModule, ToastrService } from 'ngx-toastr';
import { Lightbox, LightboxModule } from 'ngx-lightbox';
import { PickCheckerService } from '../services/pick-checker.service';
import { PredictionService } from '../services/prediction.service';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { provideAnimations } from '@angular/platform-browser/animations';
import { BarGraphComponent } from '../bar-graph/bar-graph.component';
import { AiPowerballService } from '../services/ai-powerball.service';
import { PowerballDataMinusLatest } from '../data/historical-data';
import { PowerballConfigService } from '../services/powerball-config.service';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import {
  PowerballDraw,
  RecentDrawing,
  CheckPicksResult,
  GeneratedPlay,
  Win,
} from '../models/powerball-draw.interface';
import { BacktestService } from '../services/backtest.service';
import { StrategyFactoryService } from '../services/strategies/strategy-factory.service';
import { GenerationContext } from '../services/strategies/generation-strategy.interface';
import { DiffAnalysisService } from '../services/diff-analysis.service';
import {
  PickDiffAnalysis,
  DiffPatternAnalysis,
} from '../models/powerball-draw.interface';
import { PowerballData } from '../data/powerball-data';

@Component({
  selector: 'app-play-generator',
  standalone: true,
  imports: [
    CommonModule,
    ToastrModule,
    HttpClientModule,
    LightboxModule,
    BarGraphComponent,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatCheckboxModule,
    MatRadioModule,
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
    MatChipsModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
  ],
  providers: [provideAnimations()],
  templateUrl: './play-generator.component.html',
  styleUrl: './play-generator.component.scss',
})
export class PlayGeneratorComponent implements OnInit {
  title = 'lottery-app';
  play: string[] = [];
  history: string[][] = [];
  year = new Date().getFullYear();
  totalMatches: number = 0;

  aiResults: string[][] = [];

  recentDrawings: string[][] = [];
  matchingSets: { index: number }[] = [];
  latestDrawing: RecentDrawing = { date: '', numbers: [], multiplier: '' };
  winningPicks: string[][] = [];
  newGenResults: GeneratedPlay | null = null;
  playBasedOnPredictedPowerballResults: string[] = [];
  combindResults: CheckPicksResult | null = null;
  prediction: string[] = [];

  historicalDisplayedColumns: string[] = [
    'date',
    'historical_draw',
    'match_types',
    'matching_picks',
    'multiplier',
    'month',
    'year',
  ];

  // Diff analysis results
  diffAnalyses: PickDiffAnalysis[] = [];
  diffPatternAnalysis: DiffPatternAnalysis | null = null;
  diffPatternPicks: string[][] = [];

  // Target win optimization settings
  targetWinOptimizationEnabled: boolean = false;
  targetWinType: 'fourWhite' | 'threeWhitePowerball' | 'both' = 'both';

  constructor(
    private powerballService: PowerballService,
    private toastr: ToastrService,
    private lightbox: Lightbox,
    private pickCheckerService: PickCheckerService,
    private aiService: AiPowerballService,
    private configService: PowerballConfigService,
    private backtestService: BacktestService,
    private strategyFactory: StrategyFactoryService,
    private diffAnalysisService: DiffAnalysisService
  ) {
    // Load initial settings from config
    const targetConfig = this.configService.get('targetWinOptimization');
    this.targetWinOptimizationEnabled = targetConfig.enabled;
    this.targetWinType = targetConfig.targetType;
  }

  async ngOnInit(): Promise<void> {
    await this.generateTicket();
    await this.runBacktest();
  }

  async generateTicket(): Promise<void> {
    try {
      this.history = [];
      this.aiResults = [];
      this.newGenResults = null;
      this.playBasedOnPredictedPowerballResults = [];
      this.totalMatches = 0;

      // 1) Prep historical draws (minus latest — leakage-safe)
      const parsedDraws = this.parseDrawHistoryForModel(
        PowerballDataMinusLatest
      );

      if (!parsedDraws || parsedDraws.length === 0) {
        throw new Error('No historical data available');
      }

      // 2) (Optional) kick the mock train
      this.aiService
        .trainModel(parsedDraws)
        .then((status) => {
          if (status) {
            // console.log('Training status:', status);
          } else {
            console.warn('Model training was skipped or failed');
          }
        })
        .catch((error) => {
          console.warn('Model training error (non-critical):', error);
        });

      const legacyPlays: string[][] = [];

      // Update config with current UI settings
      this.configService.set('targetWinOptimization', {
        enabled: this.targetWinOptimizationEnabled,
        targetType: this.targetWinType,
        patternAnalysisWindow: this.configService.get('targetWinOptimization').patternAnalysisWindow,
        coOccurrenceThreshold: this.configService.get('targetWinOptimization').coOccurrenceThreshold,
      });

      // 3) Generate plays - use target win strategy if enabled, otherwise use legacy generator
      const counter = this.configService.get('generation').counter;
      
      if (this.targetWinOptimizationEnabled) {
        // Use target win strategy
        try {
          // Build generation context similar to PowerballService
          const parsedDrawsForContext = this.parseDrawHistoryForModel(
            PowerballDataMinusLatest
          );
          
          // We need to get the context from PowerballService or build it ourselves
          // For now, we'll generate directly using the strategy with minimal context
          const targetWinStrategy = this.strategyFactory.getStrategy('targetWin');
          
          if (targetWinStrategy) {
            // Create a minimal context - the strategy will handle data conversion internally
            const context = this.buildGenerationContext(parsedDrawsForContext);
            
            for (let i = 0; i < counter; i++) {
              try {
                const targetPlay = await targetWinStrategy.generate(context);
                const formattedPlay: string[] = targetPlay.map((num: string) => 
                  (num.length === 1 ? `0${num}` : num)
                );

                if (formattedPlay && formattedPlay.length === 6) {
                  legacyPlays.push(formattedPlay);
                }
              } catch (error) {
                console.error(`Error generating target win play ${i + 1}:`, error);
                // Fallback to legacy if target win fails
                try {
                  const legacy = await this.powerballService.generatePowerballPlay();
                  const legacyPlay: string[] = (
                    legacy?.predictiveWeightedRandomPlay || []
                  ).map((num: string) => (num.length === 1 ? `0${num}` : num));

                  if (legacyPlay && legacyPlay.length === 6) {
                    legacyPlays.push(legacyPlay);
                  }
                } catch (fallbackError) {
                  console.error(`Error in fallback generation ${i + 1}:`, fallbackError);
                }
              }
            }
          } else {
            throw new Error('Target win strategy not available');
          }
        } catch (error) {
          console.error('Error in target win strategy generation, falling back to legacy:', error);
          // Fallback to legacy generation
          for (let i = 0; i < counter; i++) {
            try {
              const legacy = await this.powerballService.generatePowerballPlay();
              const legacyPlay: string[] = (
                legacy?.predictiveWeightedRandomPlay || []
              ).map((num: string) => (num.length === 1 ? `0${num}` : num));

              if (legacyPlay && legacyPlay.length === 6) {
                legacyPlays.push(legacyPlay);
              }
            } catch (fallbackError) {
              console.error(`Error generating legacy play ${i + 1}:`, fallbackError);
            }
          }
        }
      } else {
        // Use legacy generator
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
            // Continue with next iteration
          }
        }
      }

      if (legacyPlays.length === 0) {
        throw new Error('Failed to generate any plays');
      }

      // 4) Batch-generate ML tickets (weighted random + diversity)
      const seed = Date.now() % 1_000_000_000; // reproducible-ish per click
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
        console.warn(
          'ML batch generation failed, continuing with legacy plays only:',
          error
        );
        batch = null;
      }

      const mlTickets: string[][] =
        batch?.tickets?.map((t) => t.full_set) ?? [];

      // 5) Merge legacy + ML results for your pick checker
      const combined = [...mlTickets, ...legacyPlays];

      if (combined.length === 0) {
        throw new Error('No plays generated');
      }

      // 6) Compute matches against recent draws (same logic you had)
      const pastDrawingCount =
        this.configService.get('generation').pastDrawingCount;
      let recentDrawings: RecentDrawing[] = [];
      try {
        recentDrawings = await this.powerballService.getRecentDrawings(
          pastDrawingCount
        );
      } catch (error) {
        console.error('Error fetching recent drawings:', error);
        recentDrawings = [];
      }

      const latestResult = PowerballData[0];
      this.latestDrawing = latestResult
        ? {
            date: latestResult.draw_date,
            numbers: latestResult.winning_numbers.split(' '),
            multiplier: latestResult.multiplier,
          }
        : {
            date: '',
            numbers: [],
            multiplier: '',
          };

      const matchedSetsIdx: number[] = [];
      recentDrawings.forEach((set, i) => {
        if (combined[0] && set.numbers) {
          const matches = set.numbers.filter((num: string, idx: number) => {
            // compare to the *first* ticket in combined (legacyPlay),
            // or swap to any ticket you want to analyze
            return (combined[0]?.[idx] ?? '') === num;
          });
          if (matches.length >= 4) matchedSetsIdx.push(i);
        }
      });

      this.recentDrawings = recentDrawings
        .filter((_, i) => matchedSetsIdx.includes(i))
        .map((s) => s.numbers);
      this.totalMatches = matchedSetsIdx.length;

      // 7) Update UI data & run your checker
      this.play = legacyPlays[0]; // what you currently show as "the" play
      this.aiResults = mlTickets; // keep around if you want to render them
      this.history = combined; // existing UI expects history to be list of plays

      try {
        this.combindResults = this.pickCheckerService.checkPicks(combined);
      } catch (error) {
        console.error('Error checking picks:', error);
        this.combindResults = {
          totalWins: 0,
          totalDraws: 0,
          myPicks: combined.length,
          picks: combined,
          wins: [],
          organizedResults: [] as Array<Record<string, Win[]>>,
          targetWins: {
            fourWhite: [],
            threeWhitePowerball: [],
          },
        };
      }

      // 8) Analyze generated picks against latest draw for diff patterns
      try {
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
        }
      } catch (error) {
        console.error('Error performing diff analysis:', error);
        // Don't throw - diff analysis is optional
        this.diffAnalyses = [];
        this.diffPatternAnalysis = null;
      }

      this.toastr.success('', 'Generated Powerball Plays', {
        timeOut: 1500,
        positionClass: 'toast-bottom-right',
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'An unknown error occurred while generating plays';
      console.error('Error generating ticket:', error);
      this.toastr.error(errorMessage, 'Generation Failed', {
        timeOut: 3000,
        positionClass: 'toast-bottom-right',
      });
    }
  }

  async runBacktest() {
    const results = await this.backtestService.runBacktest({
      initialTrainingSize: 100,
      stepSize: 1,
      holdoutSize: 1,
      strategies: ['all'],
      ticketsPerStrategy: 20,
      maxSteps: 50,
    });

    console.log(this.backtestService.formatResultsForConsole(results));

    // Or export to JSON
    const json = this.backtestService.exportToJson(results);

  }

  /**
   * Runs a backtest specifically for the diff pattern strategy.
   * Can optionally include other strategies for comparison.
   * 
   * @param includeOtherStrategies - If true, includes 'legacy', 'prediction', and 'ai' strategies for comparison
   * @param maxSteps - Optional limit on number of backtest steps (default: 50)
   * @param ticketsPerStrategy - Number of tickets to generate per strategy (default: 20)
   */
  async runDiffPatternBacktest(
    includeOtherStrategies: boolean = false,
    maxSteps: number = 50,
    ticketsPerStrategy: number = 20
  ): Promise<void> {
    try {
      const strategies = includeOtherStrategies
        ? ['legacy', 'prediction', 'ai', 'diffPattern']
        : ['diffPattern'];

      const results = await this.backtestService.runBacktest({
        initialTrainingSize: 100,
        stepSize: 1,
        holdoutSize: 1,
        strategies: strategies,
        ticketsPerStrategy: ticketsPerStrategy,
        maxSteps: maxSteps,
      });

      console.log('=== DIFF PATTERN BACKTEST RESULTS ===');
      console.log(this.backtestService.formatResultsForConsole(results));

      // Export to JSON for further analysis
      const json = this.backtestService.exportToJson(results);
      console.log('Backtest results (JSON):', json);

      this.toastr.success(
        `Diff pattern backtest completed: ${results.summary.totalSteps} steps`,
        'Backtest Complete',
        {
          timeOut: 3000,
          positionClass: 'toast-bottom-right',
        }
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'An unknown error occurred while running the diff pattern backtest';
      console.error('Error running diff pattern backtest:', error);
      this.toastr.error(errorMessage, 'Backtest Failed', {
        timeOut: 3000,
        positionClass: 'toast-bottom-right',
      });
    }
  }

  /**
   * Converts raw historical draw data into a number[][] format
   * required by the AI prediction backend.
   *
   * Each inner array is [white1, white2, white3, white4, white5, powerball]
   */
  parseDrawHistoryForModel(draws: PowerballDraw[]): number[][] {
    return draws.map((draw) => {
      const numbers = draw.winning_numbers
        .split(' ')
        .map((n) => parseInt(n, 10));
      return numbers;
    });
  }

  open(): void {
    const image = ['../assets/winnings_chart.png'];

    this.lightbox.open(
      [
        {
          src: '../assets/winnings_chart.png',
          caption: '',
          thumb: '',
        },
      ],
      0
    );
  }

  close(): void {
    this.lightbox.close();
  }

  /**
   * Builds a generation context for strategies.
   * This creates a minimal context that strategies need.
   * For full context features, we'd need access to PowerballService's internal methods,
   * but we'll use a simplified version here.
   */
  private buildGenerationContext(historicalData: number[][]): GenerationContext {
    // Convert historical data to string format
    const historicalDataStrings: string[][] = historicalData.map(draw => 
      draw.map(num => num.toString().padStart(2, '0'))
    );

    // Build a basic synergy map
    const synergyMap: {
      [positionIndex: number]: {
        [currentNum: string]: { [nextNum: string]: number };
      };
    } = {};

    // Initialize synergy map positions
    for (let i = 0; i < 5; i++) {
      synergyMap[i] = {};
    }

    // Build synergy data from historical draws
    for (const row of historicalDataStrings) {
      if (!row || row.length < 6) continue;
      for (let i = 0; i < 4; i++) {
        const current = row[i];
        const next = row[i + 1];
        if (!current || !next) continue;
        if (!synergyMap[i][current]) {
          synergyMap[i][current] = {};
        }
        if (!synergyMap[i][current][next]) {
          synergyMap[i][current][next] = 0;
        }
        synergyMap[i][current][next]++;
      }
    }

    // Build filtered parsed sets (simplified - just extract numbers)
    const filteredParsedSets: Array<{ key: string; numbers: number[] }> = [];
    const positions = ['first', 'second', 'third', 'fourth', 'fifth', 'powerball'];
    
    for (const position of positions) {
      const numbers: number[] = [];
      for (const draw of historicalData) {
        const idx = positions.indexOf(position);
        if (idx >= 0 && idx < draw.length) {
          numbers.push(draw[idx]);
        }
      }
      filteredParsedSets.push({ key: position, numbers });
    }

    // Create helper methods that delegate to PowerballService-like logic
    // For simplicity, we'll use basic implementations
    return {
      historicalData: historicalDataStrings,
      filteredParsedSets,
      synergyMap,
      pickAdvancedProbabilityNumber: (bestGuessSet: string[]) => {
        // Simple weighted random selection
        if (!bestGuessSet || bestGuessSet.length === 0) {
          const min = 1;
          const max = 69;
          const rand = Math.floor(Math.random() * (max - min + 1)) + min;
          return rand.toString().padStart(2, '0');
        }
        const frequencies: Record<string, number> = {};
        for (const num of bestGuessSet) {
          frequencies[num] = 0;
        }
        
        // Count occurrences in historical data
        for (const draw of historicalDataStrings) {
          for (const num of draw.slice(0, 5)) {
            if (bestGuessSet.includes(num)) {
              frequencies[num] = (frequencies[num] || 0) + 1;
            }
          }
        }

        // Build weighted array
        const weightedArray: string[] = [];
        for (const [num, count] of Object.entries(frequencies)) {
          for (let i = 0; i < (count || 1); i++) {
            weightedArray.push(num);
          }
        }

        return weightedArray.length > 0
          ? weightedArray[Math.floor(Math.random() * weightedArray.length)]
          : bestGuessSet[Math.floor(Math.random() * bestGuessSet.length)];
      },
      pickAdvancedProbabilityNumberWithRecency: (bestGuessSet: string[], recencyThreshold: number) => {
        // Use the basic method for now - could enhance with recency weighting later
        if (!bestGuessSet || bestGuessSet.length === 0) {
          const min = 1;
          const max = 69;
          const rand = Math.floor(Math.random() * (max - min + 1)) + min;
          return rand.toString().padStart(2, '0');
        }
        const frequencies: Record<string, number> = {};
        for (const num of bestGuessSet) {
          frequencies[num] = 0;
        }
        
        // Count occurrences in recent historical data only
        const recentData = historicalDataStrings.slice(-recencyThreshold);
        for (const draw of recentData) {
          for (const num of draw.slice(0, 5)) {
            if (bestGuessSet.includes(num)) {
              frequencies[num] = (frequencies[num] || 0) + 1;
            }
          }
        }

        const weightedArray: string[] = [];
        for (const [num, count] of Object.entries(frequencies)) {
          for (let i = 0; i < (count || 1); i++) {
            weightedArray.push(num);
          }
        }

        return weightedArray.length > 0
          ? weightedArray[Math.floor(Math.random() * weightedArray.length)]
          : bestGuessSet[Math.floor(Math.random() * bestGuessSet.length)];
      },
      pickMostFrequentFirstNumber: (powerball?: boolean) => {
        const index = powerball ? 5 : 0;
        const firstNumbers = historicalDataStrings.map(draw => draw[index] || '01');
        const frequencies: Record<string, number> = {};
        for (const num of firstNumbers) {
          frequencies[num] = (frequencies[num] || 0) + 1;
        }
        let mostFrequent = '01';
        let maxCount = 0;
        for (const [num, count] of Object.entries(frequencies)) {
          if (count > maxCount) {
            maxCount = count;
            mostFrequent = num;
          }
        }
        return mostFrequent;
      },
      pickWeightedRandomFirstNumber: (powerball?: boolean) => {
        const index = powerball ? 5 : 0;
        const firstNumbers = historicalDataStrings.map(draw => draw[index] || '01');
        const frequencies: Record<string, number> = {};
        for (const num of firstNumbers) {
          frequencies[num] = (frequencies[num] || 0) + 1;
        }
        const weightedArray: string[] = [];
        for (const [num, count] of Object.entries(frequencies)) {
          for (let i = 0; i < count; i++) {
            weightedArray.push(num);
          }
        }
        return weightedArray.length > 0
          ? weightedArray[Math.floor(Math.random() * weightedArray.length)]
          : '01';
      },
      generateNextNumberArray: (selectedNumber: string, customIndex?: number) => {
        const index = customIndex || 0;
        const nextNumbers: string[] = [];
        for (const draw of historicalDataStrings) {
          if (draw[index] === selectedNumber && index < 4) {
            nextNumbers.push(draw[index + 1]);
          }
        }
        if (nextNumbers.length === 0) {
          const min = 1;
          const max = 69;
          const rand = Math.floor(Math.random() * (max - min + 1)) + min;
          return [rand.toString().padStart(2, '0')];
        }
        return nextNumbers;
      },
      randomNumberInRange: (min: number, max: number) => {
        const rand = Math.floor(Math.random() * (max - min + 1)) + min;
        return rand.toString().padStart(2, '0');
      },
      buildWithTheFirst: (firstPredictedNumber: string, initialPlay: string[]) => {
        // Simplified implementation
        const play = [firstPredictedNumber];
        while (play.length < 5) {
          const nextNum = this.generateHelperRandomNumber(1, 69);
          if (!play.includes(nextNum)) {
            play.push(nextNum);
          }
        }
        if (play.length === 5) {
          play.push(this.generateHelperRandomNumber(1, 26));
        }
        return play.length === 6 ? play : [...play.slice(0, 5), this.generateHelperRandomNumber(1, 26)];
      },
      pickPowerballAi: () => {
        const powerballs = historicalDataStrings.map(draw => draw[5] || '01');
        const frequencies: Record<string, number> = {};
        for (const pb of powerballs) {
          frequencies[pb] = (frequencies[pb] || 0) + 1;
        }
        const weightedArray: string[] = [];
        for (const [pb, count] of Object.entries(frequencies)) {
          for (let i = 0; i < count; i++) {
            weightedArray.push(pb);
          }
        }
        if (weightedArray.length > 0) {
          return weightedArray[Math.floor(Math.random() * weightedArray.length)];
        }
        const min = 1;
        const max = 26;
        const rand = Math.floor(Math.random() * (max - min + 1)) + min;
        return rand.toString().padStart(2, '0');
      },
      generateFallbackSet: () => {
        const fallback: string[] = [];
        for (let i = 0; i < 5; i++) {
          fallback.push(this.generateHelperRandomNumber(1, 69));
        }
        fallback.push(this.generateHelperRandomNumber(1, 26));
        return fallback;
      },
      sortGeneratedSet: (generated: string[] | string[][]) => {
        if (Array.isArray(generated) && generated.length > 0) {
          if (Array.isArray(generated[0])) {
            // Array of arrays - sort first array and return it
            return this.sortPlayHelper((generated as string[][])[0]);
          } else if (generated.length === 6) {
            // Single play
            return this.sortPlayHelper(generated as string[]);
          }
        }
        return (generated as string[]).length === 6 ? (generated as string[]) : [];
      },
    };
  }

  /**
   * Sorts a play: white balls ascending, powerball last.
   */
  private sortPlayHelper(play: string[]): string[] {
    if (!play || play.length !== 6) return play;
    const whiteBalls = play.slice(0, 5)
      .map(num => parseInt(num, 10))
      .sort((a, b) => a - b)
      .map(num => num.toString().padStart(2, '0'));
    return [...whiteBalls, play[5]];
  }

  /**
   * Helper method to generate a random number in range as a zero-padded string.
   */
  private generateHelperRandomNumber(min: number, max: number): string {
    const rand = Math.floor(Math.random() * (max - min + 1)) + min;
    return rand.toString().padStart(2, '0');
  }

  /**
   * Handles target win optimization toggle.
   */
  onTargetWinOptimizationToggle(): void {
    this.configService.set('targetWinOptimization', {
      ...this.configService.get('targetWinOptimization'),
      enabled: this.targetWinOptimizationEnabled,
      targetType: this.targetWinType,
    });
  }

  /**
   * Handles target win type change.
   */
  onTargetWinTypeChange(): void {
    this.configService.set('targetWinOptimization', {
      ...this.configService.get('targetWinOptimization'),
      enabled: this.targetWinOptimizationEnabled,
      targetType: this.targetWinType,
    });
  }

  /**
   * Generates picks using the existing diff pattern analysis.
   * Uses the DiffPatternStrategy to generate picks based on identified patterns.
   * 
   * @param numPicks - Number of picks to generate (default: 20)
   */
  async generateDiffPatternPicks(numPicks: number = 20): Promise<void> {
    try {
      // Check if diff pattern analysis is available
      if (!this.diffPatternAnalysis || !this.diffPatternAnalysis.patterns || this.diffPatternAnalysis.patterns.length === 0) {
        this.toastr.warning('No diff pattern analysis available. Please generate picks first.', 'Pattern Analysis Required', {
          timeOut: 3000,
          positionClass: 'toast-bottom-right',
        });
        this.diffPatternPicks = [];
        return;
      }

      // Get the DiffPatternStrategy from StrategyFactoryService
      const diffPatternStrategy = this.strategyFactory.getStrategy('diffPattern');
      if (!diffPatternStrategy) {
        throw new Error('DiffPatternStrategy not available');
      }

      // Prepare historical data for context building
      const parsedDraws = this.parseDrawHistoryForModel(
        PowerballDataMinusLatest
      );

      if (!parsedDraws || parsedDraws.length === 0) {
        throw new Error('No historical data available');
      }

      // Build generation context with diff patterns included
      const context = this.buildGenerationContext(parsedDraws);
      context.diffPatterns = this.diffPatternAnalysis;

      // Generate picks using the diff pattern strategy
      const generatedPicks: string[][] = [];
      for (let i = 0; i < numPicks; i++) {
        try {
          const pick = await diffPatternStrategy.generate(context);
          if (pick && pick.length === 6) {
            // Ensure proper formatting (zero-padded)
            const formattedPick: string[] = pick.map((num: string) => 
              (num.length === 1 ? `0${num}` : num)
            );
            generatedPicks.push(formattedPick);
          }
        } catch (error) {
          console.error(`Error generating diff pattern pick ${i + 1}:`, error);
          // Continue with next iteration
        }
      }

      this.diffPatternPicks = generatedPicks;

      this.toastr.success(`Generated ${generatedPicks.length} diff pattern picks`, 'Diff Pattern Picks Generated', {
        timeOut: 1500,
        positionClass: 'toast-bottom-right',
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'An unknown error occurred while generating diff pattern picks';
      console.error('Error generating diff pattern picks:', error);
      this.toastr.error(errorMessage, 'Generation Failed', {
        timeOut: 3000,
        positionClass: 'toast-bottom-right',
      });
      this.diffPatternPicks = [];
    }
  }

  /**
   * Gets all generated picks combining history and diffPatternPicks.
   * @returns Combined array of all generated picks
   */
  getAllGeneratedPicks(): string[][] {
    return [...this.history, ...this.diffPatternPicks];
  }

  /**
   * Copies all generated picks to clipboard.
   * Formats each pick as space-separated numbers (e.g., "01 15 28 57 58 63").
   * Shows toast notifications for success/error.
   */
  async copyHistoryToClipboard(): Promise<void> {
    try {
      const allPicks = this.getAllGeneratedPicks();
      
      if (allPicks.length === 0) {
        this.toastr.warning('No picks to copy', 'Clipboard Copy', {
          timeOut: 2000,
          positionClass: 'toast-bottom-right',
        });
        return;
      }

      // Format each pick as space-separated numbers
      const formattedPicks = allPicks.map(pick => pick.join(' '));
      
      // Join all picks with newlines
      const clipboardText = formattedPicks.join('\n');

      // Copy to clipboard
      await navigator.clipboard.writeText(clipboardText);

      this.toastr.success(
        `Copied ${allPicks.length} pick${allPicks.length === 1 ? '' : 's'} to clipboard`,
        'Clipboard Copy',
        {
          timeOut: 2000,
          positionClass: 'toast-bottom-right',
        }
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'An unknown error occurred while copying to clipboard';
      console.error('Error copying to clipboard:', error);
      this.toastr.error(errorMessage, 'Clipboard Copy Failed', {
        timeOut: 3000,
        positionClass: 'toast-bottom-right',
      });
    }
  }

  /**
   * Formats a pick array for display
   */
  formatPick(pick: string[]): string {
    if (!pick || pick.length !== 6) return '';
    return `${pick.slice(0, 5).join(' ')} ${pick[5]}`;
  }

  /**
   * Formats historical draw array for display
   */
  formatHistoricalDraw(draw: string[]): string {
    if (!draw || draw.length !== 6) return '';
    return `${draw.slice(0, 5).join(' ')} ${draw[5]}`;
  }

  /**
   * Calculates match type for a single pick against a historical draw
   * Returns format like "3w+PB", "4w", "4w+PB", etc.
   */
  getMatchType(pick: string[], historicalDraw: string[]): string {
    if (!pick || !historicalDraw || pick.length !== 6 || historicalDraw.length !== 6) {
      return '';
    }

    // Create a set for quick lookup of white balls (indices 0-4)
    const whiteBallsSet = new Set(historicalDraw.slice(0, 5));

    // Count white ball matches (indices 0-4)
    let whiteMatches = 0;
    for (let i = 0; i < 5; i++) {
      if (whiteBallsSet.has(pick[i])) {
        whiteMatches++;
      }
    }

    // Check powerball match (index 5)
    const powerballMatch = pick[5] === historicalDraw[5];

    // Format match type
    if (powerballMatch) {
      return `${whiteMatches}w+PB`;
    } else {
      return `${whiteMatches}w`;
    }
  }

  /**
   * Gets all unique match types for all matching picks in a win
   */
  getMatchTypesForDraw(win: Win): string {
    if (!win || !win.matching_picks || win.matching_picks.length === 0) {
      return '';
    }

    const matchTypes = new Set<string>();
    for (const pick of win.matching_picks) {
      const matchType = this.getMatchType(pick, win.historical_draw);
      if (matchType) {
        matchTypes.add(matchType);
      }
    }

    return Array.from(matchTypes).sort().join(', ');
  }
}
