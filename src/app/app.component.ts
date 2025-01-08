import { Component, OnInit } from '@angular/core';
import { PowerballService } from './services/powerball.service';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';
import { ToastrModule } from 'ngx-toastr';
import { provideAnimations } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { Lightbox, LightboxModule } from 'ngx-lightbox';

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

  constructor(
    private powerballService: PowerballService,
    private toastr: ToastrService,
    private lightbox: Lightbox
  ) {}

  async ngOnInit(): Promise<void> {
      await this.generateTicket();
  }

  async generateTicket(): Promise<void> {
    const generatePowerballPlayResults = await this.powerballService.generatePowerballPlay();
    const pastDrawingCount = 49;
    const recentDrawings = await this.powerballService.getRecentDrawings(pastDrawingCount);

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

    this.toastr.success('', 'Generated Powerball Play', {
      timeOut: 1500,
      positionClass: 'toast-bottom-right'
    });
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
