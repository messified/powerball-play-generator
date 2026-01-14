# Agent E Validation Module

This module implements validation tests for Agent E as specified in the Statistical Validation Plan.

## Overview

Agent E is responsible for:
1. **UI Consistency Validation**: Comparing UI outputs vs service outputs for consistency (100% match required)
2. **Reporting Integrity Validation**: Validating that displayed statistics match computed values

## Files

- `agent-e-ui-consistency-validator.ts`: Validates UI vs service output consistency
- `agent-e-reporting-integrity-validator.ts`: Validates reporting integrity
- `agent-e-test-runner.ts`: Test runner that executes all validators and generates reports
- `index.ts`: Module exports

## Usage

### Basic Usage

```typescript
import { AgentETestRunner } from './validation';
import { PowerballService } from '../services/powerball.service';
import { PowerballConfigService } from '../services/powerball-config.service';
import { PickCheckerService } from '../services/pick-checker.service';
import { DiffAnalysisService } from '../services/diff-analysis.service';
import { BacktestService } from '../services/backtest.service';

// Initialize services (typically via dependency injection)
const powerballService = new PowerballService(configService, strategyFactory);
const pickCheckerService = new PickCheckerService();
const diffAnalysisService = new DiffAnalysisService();
const backtestService = new BacktestService(/* ... */);

// Create test runner
const runner = new AgentETestRunner(
  powerballService,
  configService,
  pickCheckerService,
  diffAnalysisService,
  backtestService
);

// Run all tests
const results = await runner.runAllTests();

// Generate summary
const summary = runner.generateSummary(results);
console.log(summary);

// Export to JSON
const json = runner.exportToJson(results);
// Save to file: agent-e-ui-service-comparison-report.json
// Save to file: agent-e-reporting-integrity-report.json
```

### Individual Validators

You can also use the validators individually:

```typescript
import { UIConsistencyValidator } from './validation';
import { ReportingIntegrityValidator } from './validation';

// UI Consistency
const uiValidator = new UIConsistencyValidator(/* services */);
const uiReport = await uiValidator.runAllTests();

// Reporting Integrity
const reportingValidator = new ReportingIntegrityValidator(/* services */);
const reportingReport = await reportingValidator.runAllTests();
```

## Test Coverage

### UI Consistency Tests

1. **Play Generation Consistency**: Compares plays generated via PowerballService directly vs via component logic
2. **Pick Checker Consistency**: Compares pick checking results from service vs component usage
3. **Diff Analysis Consistency**: Compares diff analysis results from service vs component usage
4. **Backtest Results Consistency**: Compares backtest results from service vs component usage

### Reporting Integrity Tests

1. **Backtest Summary Statistics Integrity**: Verifies that summary statistics match detailed step-by-step calculations
2. **Pick Checker Statistics Integrity**: Verifies that pick checker statistics match manual calculations
3. **Diff Analysis Statistics Integrity**: Verifies that diff analysis statistics match manual calculations
4. **Backtest Chart Data Integrity**: Verifies that chart data matches underlying step results

## Report Format

Reports follow the format specified in the Statistical Validation Plan:

```json
{
  "agent": "Agent-E",
  "timestamp": "ISO-8601 timestamp",
  "testSuite": "Test suite name",
  "summary": {
    "totalTests": 10,
    "passed": 8,
    "failed": 2,
    "skipped": 0,
    "status": "FAIL"
  },
  "results": [
    {
      "testName": "Test name",
      "status": "PASS|FAIL|SKIP",
      "computedValue": "computed value",
      "displayedValue": "displayed value",
      "matches": true,
      "differences": ["difference details"],
      "sampleSize": 1000,
      "timestamp": "ISO-8601 timestamp"
    }
  ],
  "artifacts": []
}
```

## Pass/Fail Criteria

### UI Consistency
- **PASS**: UI outputs match service outputs (100% consistency)
- **FAIL**: UI outputs differ from service outputs or any calculation mismatch

### Reporting Integrity
- **PASS**: Displayed statistics match computed statistics (within tolerance)
- **FAIL**: Displayed statistics differ from computed statistics beyond tolerance

## Notes

- Due to randomness in play generation, exact matches may not always be possible. Tests validate structure and format consistency instead.
- Floating-point comparisons use tolerance (typically 0.001 for averages, 0.01 for percentages).
- Tests are designed to be deterministic where possible, but some randomness is expected in lottery number generation.
