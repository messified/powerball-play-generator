import { Component, OnInit } from '@angular/core';
import { PowerballService } from '../services/powerball.service';
import { ToastrModule, ToastrService } from 'ngx-toastr';
import { Lightbox, LightboxModule } from 'ngx-lightbox';
import { PickCheckerService } from '../services/pick-checker.service';
import { PredictionService } from '../services/prediction.service';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { BarGraphComponent } from '../bar-graph/bar-graph.component';
import { AiPowerballService } from '../services/ai-powerball.service';
import { PowerballDataMinusLatest } from '../data/historical-data';
import { PowerballConfigService } from '../services/powerball-config.service';
import { 
  PowerballDraw, 
  RecentDrawing, 
  CheckPicksResult,
  GeneratedPlay,
  Win
} from '../models/powerball-draw.interface';

@Component({
  selector: 'app-play-generator',
  standalone: true,
  imports: [
    CommonModule,
    ToastrModule,
    HttpClientModule,
    LightboxModule,
    BarGraphComponent,
  ],
  providers: [
    provideAnimations(),
  ],
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

  constructor(
    private powerballService: PowerballService,
    private toastr: ToastrService,
    private lightbox: Lightbox,
    private pickCheckerService: PickCheckerService,
    private aiService: AiPowerballService,
    private configService: PowerballConfigService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.generateTicket();
  }

async generateTicket(): Promise<void> {
  try {
    this.history = [];
    this.aiResults = [];
    this.newGenResults = null;
    this.playBasedOnPredictedPowerballResults = [];
    this.totalMatches = 0;

    // 1) Prep historical draws (minus latest — leakage-safe)
    const parsedDraws = this.parseDrawHistoryForModel(PowerballDataMinusLatest);

    if (!parsedDraws || parsedDraws.length === 0) {
      throw new Error('No historical data available');
    }

    // 2) (Optional) kick the mock train
    this.aiService.trainModel(parsedDraws).then((status) => {
      if (status) {
        console.log('Training status:', status);
      } else {
        console.warn('Model training was skipped or failed');
      }
    }).catch((error) => {
      console.warn('Model training error (non-critical):', error);
    });

    const legacyPlays: string[][] = [];

    // 3) Call your legacy local generator once (keeps current UI vibe)
    const counter = this.configService.get('generation').counter;
    for(let i = 0; i<counter; i++) {
      try {
        const legacy = await this.powerballService.generatePowerballPlay();
        const legacyPlay: string[] = (legacy?.predictiveWeightedRandomPlay || []).map(
          (num: string) => (num.length === 1 ? `0${num}` : num)
        );

        if (legacyPlay && legacyPlay.length === 6) {
          legacyPlays.push(legacyPlay);
        }
      } catch (error) {
        console.error(`Error generating legacy play ${i + 1}:`, error);
        // Continue with next iteration
      }
    }

    if (legacyPlays.length === 0) {
      throw new Error('Failed to generate any legacy plays');
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
      console.warn('ML batch generation failed, continuing with legacy plays only:', error);
      batch = null;
    }

    const mlTickets: string[][] =
      batch?.tickets?.map(t => t.full_set) ?? [];

    // 5) Merge legacy + ML results for your pick checker
    const combined = [...mlTickets, ...legacyPlays];

    if (combined.length === 0) {
      throw new Error('No plays generated');
    }

    // 6) Compute matches against recent draws (same logic you had)
    const pastDrawingCount = this.configService.get('generation').pastDrawingCount;
    let recentDrawings: RecentDrawing[] = [];
    try {
      recentDrawings = await this.powerballService.getRecentDrawings(pastDrawingCount);
    } catch (error) {
      console.error('Error fetching recent drawings:', error);
      recentDrawings = [];
    }

    this.latestDrawing = recentDrawings[0] || { date: '', numbers: [], multiplier: '' };

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
      .map(s => s.numbers);
    this.totalMatches = matchedSetsIdx.length;

    // 7) Update UI data & run your checker
    this.play = legacyPlays[0];              // what you currently show as "the" play
    this.aiResults = mlTickets;          // keep around if you want to render them
    this.history = combined;             // existing UI expects history to be list of plays
    
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
        organizedResults: [] as Array<Record<string, Win[]>>
      };
    }

    this.toastr.success('', 'Generated Powerball Plays', {
      timeOut: 1500,
      positionClass: 'toast-bottom-right',
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred while generating plays';
    console.error('Error generating ticket:', error);
    this.toastr.error(errorMessage, 'Generation Failed', {
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
}
