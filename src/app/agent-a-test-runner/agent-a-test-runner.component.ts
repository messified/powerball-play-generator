import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgentAValidatorService } from '../services/agent-a-validator.service';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/**
 * Component to run Agent A validation tests
 */
@Component({
  selector: 'app-agent-a-test-runner',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Agent A: Randomness & Entropy Validator</mat-card-title>
        <mat-card-subtitle>Validates entropy, uniformity, RNG behavior, and coupling effects</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <p>This will run the following tests:</p>
        <ul>
          <li>Entropy Estimation (N≥2000 tickets per strategy)</li>
          <li>Uniformity Test for Initial Random (N≥1000 tickets)</li>
          <li>Coupling Detection (N≥2000 tickets per strategy pair)</li>
        </ul>
        <p><strong>Note:</strong> Tests may take several minutes to complete.</p>
        
        <div *ngIf="isRunning" style="text-align: center; margin: 20px 0;">
          <mat-spinner diameter="50"></mat-spinner>
          <p>Running tests... Please wait.</p>
        </div>
        
        <div *ngIf="!isRunning && results" style="margin-top: 20px;">
          <h3>Test Results:</h3>
          <pre>{{ results }}</pre>
        </div>
      </mat-card-content>
      <mat-card-actions>
        <button 
          mat-raised-button 
          color="primary" 
          (click)="runTests()"
          [disabled]="isRunning">
          Run Agent A Tests
        </button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [`
    mat-card {
      max-width: 800px;
      margin: 20px auto;
    }
    pre {
      background: #f5f5f5;
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
    }
  `]
})
export class AgentATestRunnerComponent implements OnInit {
  isRunning = false;
  results: string | null = null;

  constructor(private validatorService: AgentAValidatorService) {}

  ngOnInit(): void {
    // Auto-run tests on init (optional - comment out if you want manual trigger)
    // this.runTests();
  }

  async runTests(): Promise<void> {
    this.isRunning = true;
    this.results = null;
    
    try {
      console.log('Starting Agent A validation tests...');
      await this.validatorService.runAllTests();
      this.results = 'Tests completed! Check console for detailed results and downloaded JSON reports.';
    } catch (error) {
      console.error('Error running tests:', error);
      this.results = `Error: ${error}`;
    } finally {
      this.isRunning = false;
    }
  }
}
