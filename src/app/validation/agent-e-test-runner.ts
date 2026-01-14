/**
 * Agent E Test Runner
 * 
 * Executes UI consistency and reporting integrity validators and generates reports.
 */

import { UIConsistencyValidator, UIConsistencyReport } from './agent-e-ui-consistency-validator';
import { ReportingIntegrityValidator, ReportingIntegrityReport } from './agent-e-reporting-integrity-validator';
import { PowerballService } from '../services/powerball.service';
import { PowerballConfigService } from '../services/powerball-config.service';
import { PickCheckerService } from '../services/pick-checker.service';
import { DiffAnalysisService } from '../services/diff-analysis.service';
import { BacktestService } from '../services/backtest.service';

export interface AgentETestResults {
  uiConsistency: UIConsistencyReport;
  reportingIntegrity: ReportingIntegrityReport;
  timestamp: string;
}

export class AgentETestRunner {
  private uiConsistencyValidator: UIConsistencyValidator;
  private reportingIntegrityValidator: ReportingIntegrityValidator;

  constructor(
    powerballService: PowerballService,
    configService: PowerballConfigService,
    pickCheckerService: PickCheckerService,
    diffAnalysisService: DiffAnalysisService,
    backtestService: BacktestService
  ) {
    this.uiConsistencyValidator = new UIConsistencyValidator(
      powerballService,
      configService,
      pickCheckerService,
      diffAnalysisService,
      backtestService
    );

    this.reportingIntegrityValidator = new ReportingIntegrityValidator(
      backtestService,
      pickCheckerService,
      diffAnalysisService,
      powerballService
    );
  }

  /**
   * Runs all Agent E tests and generates reports.
   */
  async runAllTests(): Promise<AgentETestResults> {
    console.log('Starting Agent E validation tests...');
    console.log('Running UI Consistency tests...');
    const uiConsistency = await this.uiConsistencyValidator.runAllTests();
    
    console.log('Running Reporting Integrity tests...');
    const reportingIntegrity = await this.reportingIntegrityValidator.runAllTests();

    return {
      uiConsistency,
      reportingIntegrity,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Exports test results to JSON format.
   */
  exportToJson(results: AgentETestResults): string {
    return JSON.stringify(results, null, 2);
  }

  /**
   * Generates a summary report.
   */
  generateSummary(results: AgentETestResults): string {
    let summary = '\n=== AGENT E VALIDATION SUMMARY ===\n\n';
    
    summary += `Timestamp: ${results.timestamp}\n\n`;

    // UI Consistency Summary
    summary += 'UI Consistency Tests:\n';
    summary += `  Status: ${results.uiConsistency.summary.status}\n`;
    summary += `  Total Tests: ${results.uiConsistency.summary.totalTests}\n`;
    summary += `  Passed: ${results.uiConsistency.summary.passed}\n`;
    summary += `  Failed: ${results.uiConsistency.summary.failed}\n`;
    summary += `  Skipped: ${results.uiConsistency.summary.skipped}\n\n`;

    results.uiConsistency.results.forEach((result) => {
      summary += `  ${result.testName}: ${result.status}\n`;
      if (result.differences && result.differences.length > 0) {
        result.differences.forEach((diff) => {
          summary += `    - ${diff}\n`;
        });
      }
    });

    summary += '\n';

    // Reporting Integrity Summary
    summary += 'Reporting Integrity Tests:\n';
    summary += `  Status: ${results.reportingIntegrity.summary.status}\n`;
    summary += `  Total Tests: ${results.reportingIntegrity.summary.totalTests}\n`;
    summary += `  Passed: ${results.reportingIntegrity.summary.passed}\n`;
    summary += `  Failed: ${results.reportingIntegrity.summary.failed}\n`;
    summary += `  Skipped: ${results.reportingIntegrity.summary.skipped}\n\n`;

    results.reportingIntegrity.results.forEach((result) => {
      summary += `  ${result.testName}: ${result.status}\n`;
      if (result.differences && result.differences.length > 0) {
        result.differences.forEach((diff) => {
          summary += `    - ${diff}\n`;
        });
      }
    });

    summary += '\n=== END SUMMARY ===\n';

    return summary;
  }
}
