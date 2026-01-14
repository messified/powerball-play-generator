/**
 * Agent B Validation Component
 * 
 * Component to run Agent B validation tests and generate reports.
 * This can be accessed via a route to trigger validation.
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentBValidationService } from '../services/agent-b-validation.service';
import { PowerballDataMinusLatest } from '../data/historical-data';

@Component({
  selector: 'app-agent-b-validation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="validation-container">
      <h1>Agent B: Distribution & Bias Validation</h1>
      
      <div class="controls">
        <label>
          Number of tickets per strategy:
          <input type="number" [(ngModel)]="numTickets" min="1000" value="1000" />
        </label>
        <button (click)="runDistributionValidation()" [disabled]="running">
          Run Distribution Validation
        </button>
        <button (click)="runBiasDetection()" [disabled]="running">
          Run Bias Detection
        </button>
        <button (click)="runBoth()" [disabled]="running">
          Run Both Tests
        </button>
      </div>

      <div *ngIf="running" class="status">
        <p>Running validation tests... Please wait.</p>
      </div>

      <div *ngIf="distributionReport" class="report">
        <h2>Distribution Validation Report</h2>
        <p>Status: {{ distributionReport.summary.status }}</p>
        <p>Passed: {{ distributionReport.summary.passed }} / {{ distributionReport.summary.total_tests }}</p>
        <p>Failed: {{ distributionReport.summary.failed }}</p>
        <p>Skipped: {{ distributionReport.summary.skipped }}</p>
        <button (click)="downloadReport('distribution')">Download Distribution Report (JSON)</button>
      </div>

      <div *ngIf="biasReport" class="report">
        <h2>Bias Detection Report</h2>
        <p>Status: {{ biasReport.summary.status }}</p>
        <p>Passed: {{ biasReport.summary.passed }} / {{ biasReport.summary.total_tests }}</p>
        <p>Failed: {{ biasReport.summary.failed }}</p>
        <button (click)="downloadReport('bias')">Download Bias Report (JSON)</button>
      </div>

      <div *ngIf="error" class="error">
        <p>Error: {{ error }}</p>
      </div>
    </div>
  `,
  styles: [`
    .validation-container {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .controls {
      margin: 20px 0;
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .controls label {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .controls input {
      width: 100px;
    }
    .controls button {
      padding: 10px 20px;
      cursor: pointer;
    }
    .controls button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .status {
      margin: 20px 0;
      padding: 10px;
      background: #f0f0f0;
    }
    .report {
      margin: 20px 0;
      padding: 20px;
      border: 1px solid #ccc;
      border-radius: 5px;
    }
    .error {
      margin: 20px 0;
      padding: 10px;
      background: #ffebee;
      color: #c62828;
    }
  `],
})
export class AgentBValidationComponent implements OnInit {
  numTickets = 1000;
  running = false;
  distributionReport: any = null;
  biasReport: any = null;
  error: string | null = null;

  constructor(private validationService: AgentBValidationService) {}

  ngOnInit(): void {
    // Component initialization
  }

  async runDistributionValidation(): Promise<void> {
    this.running = true;
    this.error = null;
    this.distributionReport = null;

    try {
      const report = await this.validationService.runDistributionValidation(
        this.numTickets,
        PowerballDataMinusLatest
      );
      this.distributionReport = report;
      console.log('Distribution validation complete:', report);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Unknown error';
      console.error('Distribution validation error:', error);
    } finally {
      this.running = false;
    }
  }

  async runBiasDetection(): Promise<void> {
    this.running = true;
    this.error = null;
    this.biasReport = null;

    try {
      const report = await this.validationService.runBiasDetection(
        this.numTickets,
        PowerballDataMinusLatest
      );
      this.biasReport = report;
      console.log('Bias detection complete:', report);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Unknown error';
      console.error('Bias detection error:', error);
    } finally {
      this.running = false;
    }
  }

  async runBoth(): Promise<void> {
    await this.runDistributionValidation();
    await this.runBiasDetection();
  }

  downloadReport(type: 'distribution' | 'bias'): void {
    const report = type === 'distribution' ? this.distributionReport : this.biasReport;
    if (!report) return;

    const json = this.validationService.exportReportToJson(report, `agent-b-${type}-report.json`);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-b-${type}-report.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
