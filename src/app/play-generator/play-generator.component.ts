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
import { AgGridDataTableComponent } from '../ag-grid-data-table/ag-grid-data-table.component';

@Component({
  selector: 'app-play-generator',
  standalone: true,
  imports: [
    CommonModule,
    ToastrModule,
    HttpClientModule,
    LightboxModule,
    BarGraphComponent,
    AgGridDataTableComponent
  ],
  providers: [PowerballService, provideAnimations(), PredictionService],
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
  counter: number = 0;
  newGenResults: any;
  playBasedOnPredictedPowerballResults: any;
  combindResults: any;

  constructor(
    private powerballService: PowerballService,
    private toastr: ToastrService,
    private lightbox: Lightbox,
    private pickCheckerService: PickCheckerService,
    private predictionService: PredictionService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.generateTicket();
  }

  async generateTicket(): Promise<void> {
    this.history = [];
    this.newGenResults = {};
    this.playBasedOnPredictedPowerballResults = {};
    this.aiResults = [];

    const loopCount = 5;

    const newGenPrediction = [];
    const predictPlayBasedOnPredictedPowerball = [];
    const newPlays = [];
    const highProb = [];

    // this.playBasedOnPredictedPowerballResults =
    //   this.pickCheckerService.checkPicks(predictPlayBasedOnPredictedPowerball);

    for (let step = 0; step < loopCount; step++) {
      const BFPB = this.predictionService.predictPlayBasedOnPredictedPowerball();
      predictPlayBasedOnPredictedPowerball.push([...BFPB]);

      const newPrediction = await this.predictionService.generatePowerballPlay();
      newGenPrediction.push([...newPrediction]);

      const generatePowerballPlayResults = await this.powerballService.generatePowerballPlay();
      const pastDrawingCount = 200;
      const recentDrawings = await this.powerballService.getRecentDrawings(
        pastDrawingCount
      );

      this.latestDrawing = recentDrawings[0];

      // Format play results to ensure two digits
      this.play = generatePowerballPlayResults.predictiveWeightedRandomPlay.map(
        (num: string | any[]) => (num.length === 1 ? `0${num}` : num)
      );

      const matchedSets: { matchedSetsIndex: number }[] = [];

      // Find matching sets
      this.recentDrawings = recentDrawings.map(
        (set: { numbers: any }, i: any) => {
          const numbers = set.numbers;
          const numberMatches = numbers.filter(
            (num: string, index: number) => this.play[index] == num
          );

          if (numberMatches.length >= 3) {
            matchedSets.push({ matchedSetsIndex: i });
          }

          return set.numbers;
        }
      );

      // Filter matched sets
      this.recentDrawings = this.recentDrawings.filter((set, i) =>
        matchedSets.some((match) => match.matchedSetsIndex == i)
      );
      this.totalMatches = matchedSets.length;

      newPlays.push([...this.play]);

      generatePowerballPlayResults.aiPredictiveSet.forEach((set: any) => {
        const hasDup = set.filter((item: any, index: any) => set.indexOf(item) !== index);
        if (hasDup.length === 0) {
          this.aiResults.push([
            ...set,
          ]);
        }
      });

      highProb.push([...generatePowerballPlayResults.highestProbabilityPlay]);
    }

    this.toastr.success('', 'Generated Powerball Play', {
      timeOut: 1500,
      positionClass: 'toast-bottom-right',
    });

    const combindPicks = [
      ...newGenPrediction,
      ...newPlays,
      ...predictPlayBasedOnPredictedPowerball
    ];

    this.history = combindPicks;

    this.combindResults = this.pickCheckerService.checkPicks(combindPicks);
    const now = Date.now();
    const historyStorageKey = `generated_picks_${now}`;

    // localStorage.setItem(historyStorageKey, JSON.stringify(this.combindResults));
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
