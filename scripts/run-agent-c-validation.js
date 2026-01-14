/**
 * Agent C Validation Runner
 * 
 * This script runs the Agent C validation tests and generates JSON reports.
 * Run with: node scripts/run-agent-c-validation.js
 */

// Note: This is a placeholder script. The actual validation should be run
// through Angular's test framework or a TypeScript execution environment.
// For now, this script provides instructions on how to run the validation.

console.log('='.repeat(80));
console.log('AGENT C VALIDATION RUNNER');
console.log('='.repeat(80));
console.log('');
console.log('To run Agent C validation:');
console.log('');
console.log('Option 1: Run Angular test (recommended)');
console.log('  npm test -- --include="**/agent-c-validation.spec.ts" --watch=false');
console.log('');
console.log('Option 2: Import and run validation function');
console.log('  Import runAgentCValidation from src/app/validation/agent-c-validation.ts');
console.log('  and call it in your application code.');
console.log('');
console.log('The validation will:');
console.log('  1. Test diff calculation correctness (manual vs computed, N≥100 picks)');
console.log('  2. Test percentage calculations and sums (must be ≤100% per position)');
console.log('');
console.log('Reports will be generated in: validation-results/');
console.log('='.repeat(80));
