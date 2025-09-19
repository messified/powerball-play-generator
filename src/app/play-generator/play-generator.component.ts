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

export interface PowerballDraw {
  draw_date: string;
  winning_numbers: string;
  multiplier: string;
}

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
    PowerballService,
    provideAnimations(),
    PredictionService,
    AiPowerballService,
  ],
  templateUrl: './play-generator.component.html',
  styleUrl: './play-generator.component.scss',
})
export class PlayGeneratorComponent implements OnInit {
  title = 'lottery-app';
  play: any[] = [];
  history: string[][] = [];
  year = new Date().getFullYear();
  totalMatches: number = 0;

  aiResults: any[] = [];

  recentDrawings: string[][] = [];
  matchingSets: { index: number }[] = [];
  latestDrawing: any = {};
  winningPicks: any;
  counter: number = 60;
  newGenResults: any;
  playBasedOnPredictedPowerballResults: any;
  combindResults: any;
  prediction: any;

  constructor(
    private powerballService: PowerballService,
    private toastr: ToastrService,
    private lightbox: Lightbox,
    private pickCheckerService: PickCheckerService,
    private aiService: AiPowerballService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.generateTicket();
  }

async generateTicket(): Promise<void> {
  this.history = [];
  this.aiResults = [];
  this.newGenResults = {};
  this.playBasedOnPredictedPowerballResults = {};
  this.totalMatches = 0;

  // 1) Prep historical draws (minus latest — leakage-safe)
  const parsedDraws = this.parseDrawHistoryForModel(PowerballDataMinusLatest);

  // 2) (Optional) kick the mock train
  this.aiService.trainModel(parsedDraws).then((status) => {
    console.log('Training status:', status);
  });

  const legacyPlays = [];

  // 3) Call your legacy local generator once (keeps current UI vibe)
  for(let i = 0; i<this.counter; i++) {
    const legacy = await this.powerballService.generatePowerballPlay();
    const legacyPlay: string[] = (legacy?.predictiveWeightedRandomPlay || []).map(
      (num: string) => (num.length === 1 ? `0${num}` : num)
    );

    legacyPlays.push(legacyPlay);
  }

  // 4) Batch-generate ML tickets (weighted random + diversity)
  const seed = Date.now() % 1_000_000_000; // reproducible-ish per click
  const batch = await this.aiService.generateBatch(parsedDraws, {
    num_tickets: 60,
    diversity_min_hamming: 8,
    recency_decay: 0.98,
    alpha_smooth: 0.5,
    temperature: 0.9,
    seed,
  });

  const mlTickets: string[][] =
    batch?.tickets?.map(t => t.full_set) ?? [];

  // 5) Merge legacy + ML results for your pick checker
  const combined = [...mlTickets, ...legacyPlays];

  // 6) Compute matches against recent draws (same logic you had)
  const pastDrawingCount = 200;
  const recentDrawings = await this.powerballService.getRecentDrawings(pastDrawingCount);
  this.latestDrawing = recentDrawings[0];

  const matchedSetsIdx: number[] = [];
  recentDrawings.forEach((set, i) => {
    const matches = set.numbers.filter((num: string, idx: number) => {
      // compare to the *first* ticket in combined (legacyPlay),
      // or swap to any ticket you want to analyze
      return (combined[0]?.[idx] ?? '') === num;
    });
    if (matches.length >= 4) matchedSetsIdx.push(i);
  });

  this.recentDrawings = recentDrawings
    .filter((_, i) => matchedSetsIdx.includes(i))
    .map(s => s.numbers);
  this.totalMatches = matchedSetsIdx.length;

  // 7) Update UI data & run your checker
  this.play = legacyPlays[0];              // what you currently show as "the" play
  this.aiResults = mlTickets;          // keep around if you want to render them
  this.history = combined;             // existing UI expects history to be list of plays
  this.combindResults = this.pickCheckerService.checkPicks(combined);

  this.toastr.success('', 'Generated Powerball Plays', {
    timeOut: 1500,
    positionClass: 'toast-bottom-right',
  });
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
