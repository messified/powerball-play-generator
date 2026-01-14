## Recommended Tests for Agent 3 (Test Engineer)

This document outlines high-level regression and integration tests that Agent 3 should implement once real validation runs are available and any confirmed bugs are identified.

### 1. Agent A – Randomness & Entropy Validator

- **Regression tests for RNG behavior**
  - Verify entropy per position for each strategy remains within ±0.5 bits of expected values.
  - Add tests that fail if cross-strategy or temporal correlations exceed the thresholds in the plan (e.g., \(|r| > 0.2\)).

### 2. Agent B – Distribution & Bias Analyst

- **Distribution-shape regression tests**
  - Lock in baseline distributions (snapshots) for key strategies (e.g., `initialRandom`, `predictiveWeightedRandom`, `aiPredictive`) and fail if future distributions deviate beyond chi-square / KS tolerances.
- **Bias regression tests**
  - Ensure intended biases (recency, frequency, synergy) are present.
  - Ensure no unintended range violations, duplicates, or sorting violations occur.

### 3. Agent C – Diff Analysis Statistician

- **Diff and percentage math tests**
  - Use the existing `agent-c-validation.spec.ts` suite as the canonical regression test for:
    - Exact diff calculations (`diff = pickValue - drawValue`).
    - Percentage calculations and percentage-sum constraints (≤100.01% per position).
  - Add tests to fail explicitly on any out-of-range numbers produced by diff pattern application.

### 4. Agent D – Backtest Sanity Validator

- **Walk-forward and leakage regression tests**
  - Verify that backtest step ordering and training/test splits remain correct (no future data in training).
  - Verify that performance does not systematically improve when simulated leakage is introduced (where supported).
- **Random baseline comparison tests**
  - Assert that random baseline performance remains within ±2σ of theoretical expectations for white and powerball hits.

### 5. Agent E – Reporting & UI Consistency Auditor

- **UI vs service consistency tests**
  - Snapshot tests comparing UI-rendered statistics and charts against the corresponding service outputs.
  - Structural consistency checks for backtest results, diff analyses, and play generation outputs between UI and service.

### 6. Integration & Aggregation Tests

- **Aggregation pipeline tests**
  - Once real agent reports are generated, add tests that:
    - Verify `validation-results/master-bug-list.json` includes all failing tests with correct metadata.
    - Verify `BUGS.md` and `VALIDATION_SUMMARY.md` stay in sync with the JSON master bug list.
    - Guard against accidental deletion or regression of existing bug entries.

