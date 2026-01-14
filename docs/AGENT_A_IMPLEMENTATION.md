# Agent A: Randomness & Entropy Validator - Implementation Summary

## Overview

This document describes the implementation of Agent A's validation tests as specified in the Statistical Validation Plan. Agent A validates entropy, uniformity, RNG behavior, and coupling effects across all Powerball generation strategies.

## Implementation Files

### 1. `src/app/services/agent-a-validator.service.ts`
Main service implementing all Agent A tests:
- **Entropy Estimation Tests**: Generates N≥2000 tickets per strategy and calculates entropy per position
- **Uniformity Tests**: Generates N≥1000 tickets using Initial Random strategy and performs chi-square tests
- **Coupling Detection Tests**: Generates N≥2000 tickets per strategy pair and tests for correlation/mutual information

### 2. `src/app/services/powerball.service.ts`
Added public method `buildGenerationContextForTesting()` to expose context building for validation purposes.

### 3. `src/app/agent-a-test-runner/agent-a-test-runner.component.ts`
Angular component for running tests via UI (optional).

## Test Implementations

### Test 1: Entropy Estimation (`runEntropyEstimationTests`)

**Purpose**: Validate that each strategy produces expected entropy levels per position.

**Procedure**:
1. Generate N=2000 tickets per strategy
2. Calculate entropy H(pos_i) = -Σ P(x) × log₂(P(x)) for each position
3. Compare to expected entropy:
   - Initial Random: H ≈ log₂(|filtered_set|)
   - Weighted/Markov strategies: H < log₂(69) (reduced by weighting)

**Pass Criteria**: Entropy within ±0.5 bits of expected

**Output**: `agent-a-entropy-report.json`

### Test 2: Uniformity Test (`runUniformityTests`)

**Purpose**: Validate that Initial Random strategy produces uniform distribution over filtered sets.

**Procedure**:
1. Generate N=1000 tickets using Initial Random strategy
2. For each position, compute frequency distribution
3. Perform chi-square test against uniform distribution
4. Calculate p-value and compare to critical value (α=0.05)

**Pass Criteria**: 
- Chi-square p-value > 0.05
- Chi-square < critical value

**Output**: `agent-a-uniformity-report.json`

### Test 3: Coupling Detection (`runCouplingDetectionTests`)

**Purpose**: Detect if strategies share RNG state or are otherwise coupled.

**Procedure**:
1. Generate N=2000 tickets for each strategy
2. For each strategy pair, compute:
   - Pearson correlation coefficient per position
   - Mutual information per position
   - Chi-square independence test
3. Check if correlation/mutual information exceeds thresholds

**Pass Criteria**:
- Max correlation |r| < 0.2
- Max mutual information < 0.05 bits
- Independence test p-value > 0.05

**Output**: `agent-a-coupling-report.json`

## Usage

### Option 1: Via Service (Programmatic)

```typescript
import { AgentAValidatorService } from './services/agent-a-validator.service';

// In your component/service
constructor(private validatorService: AgentAValidatorService) {}

async runTests() {
  await this.validatorService.runAllTests();
  // Reports will be downloaded as JSON files and logged to console
}
```

### Option 2: Via UI Component

1. Add route to `app.routes.ts`:
```typescript
import { AgentATestRunnerComponent } from './agent-a-test-runner/agent-a-test-runner.component';

{ path: 'agent-a-tests', component: AgentATestRunnerComponent }
```

2. Navigate to `/agent-a-tests` in your app
3. Click "Run Agent A Tests" button

### Option 3: Individual Tests

```typescript
// Run individual tests
const context = await this.powerballService.buildGenerationContextForTesting();
const entropyResults = await this.validatorService.runEntropyEstimationTests(context);
const uniformityResults = await this.validatorService.runUniformityTests(context);
const couplingResults = await this.validatorService.runCouplingDetectionTests(context);
```

## Report Format

All reports follow the standard format specified in the plan:

```json
{
  "agent": "Agent-A",
  "timestamp": "ISO-8601 timestamp",
  "test_suite": "Test suite name",
  "summary": {
    "total_tests": 10,
    "passed": 8,
    "failed": 2,
    "status": "PASS|FAIL"
  },
  "results": [
    {
      "test_name": "Test name",
      "status": "PASS|FAIL",
      "metric": "metric_value",
      "expected": "expected_value",
      "tolerance": "tolerance_value",
      "evidence": "test_statistic, p_value, etc.",
      "sample_size": 1000
    }
  ]
}
```

## Notes

1. **Statistical Approximations**: The chi-square p-value calculation uses a simplified approximation. For production use, consider integrating a proper statistical library (e.g., `jstat`, `simple-statistics`).

2. **Performance**: Generating 2000+ tickets per strategy can take several minutes. Tests run sequentially to avoid overwhelming the system.

3. **Strategy Fallbacks**: Some strategies (e.g., diffPattern) may fallback to random generation if required data is missing. This is expected behavior and tests will still run.

4. **Browser Environment**: Reports are downloaded as JSON files in browser environments. In Node.js environments, reports are logged to console.

5. **Non-Modifying**: As per the plan, Agent A does NOT modify strategy code - it only reports findings.

## Next Steps

After running Agent A tests:
1. Review generated JSON reports
2. Identify any confirmed bugs (see plan section 6.1)
3. Escalate confirmed bugs to Agent 3 (Test Engineer) for regression test creation
4. Document acceptable variance findings

## References

- Statistical Validation Plan: `statistical_validation_plan_2542c002.plan.md`
- Plan Section 5.1: Agent A specifications
- Plan Section 6: Acceptance & Escalation Rules
