import { Component, OnInit } from '@angular/core';
import { PowerballService } from './services/powerball.service';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';
import { ToastrModule } from 'ngx-toastr';
import { provideAnimations } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { Lightbox, LightboxModule } from 'ngx-lightbox';
import { PickCheckerService } from './services/pick-checker.service';
import { count } from 'rxjs';
import { StoredHistory } from './data/generated-picks';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ToastrModule, HttpClientModule, LightboxModule],
  providers: [
    PowerballService,
    provideAnimations(),
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'lottery-app';
  play: any[] = [];
  history: string[][] = [];
  year = new Date().getFullYear();
  totalMatches: number = 0;

  recentDrawings: string[][] = [];
  matchingSets: { index: number }[] = [];
  latestDrawing: any = {};
  winningPicks: any;
  counter: number = 0;

  constructor(
    private powerballService: PowerballService,
    private toastr: ToastrService,
    private lightbox: Lightbox,
    private pickCheckerService: PickCheckerService
  ) {}

  async ngOnInit(): Promise<void> {
      await this.generateTicket();
  }

  async generateTicket(): Promise<void> {
    this.history = [];
    for (let step = 0; step < 60; step++) {
    const generatePowerballPlayResults = await this.powerballService.generatePowerballPlay();
    const pastDrawingCount = 30;
    const recentDrawings = await this.powerballService.getRecentDrawings(pastDrawingCount);

    this.latestDrawing = recentDrawings[0];

    // Format play results to ensure two digits
    this.play = generatePowerballPlayResults.map((num: string | any[]) => num.length === 1 ? `0${num}` : num);

    const matchedSets: { matchedSetsIndex: number }[] = [];

    // Find matching sets
    this.recentDrawings = recentDrawings.map((set: { numbers: any; }, i: any) => {
      const numbers = set.numbers;
      const numberMatches = numbers.filter((num: string, index: number) => this.play[index] == num);

      if (numberMatches.length >= 2) {
        matchedSets.push({ matchedSetsIndex: i });
      }

      return set.numbers;
    });

    // Filter matched sets
    this.recentDrawings = this.recentDrawings.filter((set, i) => matchedSets.some(match => match.matchedSetsIndex == i));
    this.totalMatches = matchedSets.length;

    // Save play to history
    this.history.push([...this.play]);
    }

    this.toastr.success('', 'Generated Powerball Play', {
      timeOut: 1500,
      positionClass: 'toast-bottom-right'
    });

    this.checkGeneratedPicks();
  }

  checkGeneratedPicks() {
    const count = this.counter++;
    const historyStorageKey = `generated_picks_${count}`;

    this.winningPicks = this.pickCheckerService.checkPicks(this.history);
    
    localStorage.setItem(historyStorageKey, JSON.stringify({
      totalWins: this.winningPicks.totalWins,
      pastDrawingDate: this.winningPicks.date,
      results: this.winningPicks, 
      picks: this.history
    }));

    // const storedHistory = localStorage.getItem(historyStorageKey);
    console.log('Picks Count: ', StoredHistory);
  }

  open(): void {
    const image = ['../assets/winnings_chart.png'];

    this.lightbox.open([{
      src: '../assets/winnings_chart.png',
      caption: '',
      thumb: '',
    }], 0);
  }

  close(): void {
    this.lightbox.close();
  }
}
