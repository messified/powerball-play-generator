## Master Bug List (Human-Readable)

**Source of truth (machine-readable):** `validation-results/master-bug-list.json`

### Summary

- **Confirmed bugs:** 0  
- **Acceptable variance items:** 0 (no executed validation reports yet)

### Confirmed Bugs

As of 2026-01-13, **no confirmed bugs** have been identified by Agents A–E according to the criteria in the statistical validation plan (section 6.1).

This means:

- No range violations (out-of-range numbers) have been documented.
- No duplicate white balls or sorting violations have been documented.
- No ensemble weight normalization errors have been documented.
- No diff analysis math or percentage-sum violations have been documented.
- No statistically significant leakage or backtest inconsistencies have been documented.

This section should be updated whenever:

- A validation report records one or more failing tests that meet the **confirmed bug** criteria.
- A human reviewer classifies a test failure as a true bug vs. acceptable variance.

### Acceptable Variance

The current `master-bug-list.json` file contains only a placeholder variance entry (`VAR-001`) indicating that all agent validations are pending execution and that no statistical variance has been assessed yet.

Once real validation runs are available, this section should document cases where:

- Metrics deviate from theoretical expectations but remain **within defined tolerances**.
- Biases are confirmed as **intentional** (e.g., recency weighting, frequency filtering).
- Lower entropy or position correlations are **expected behavior** for specific strategies.

