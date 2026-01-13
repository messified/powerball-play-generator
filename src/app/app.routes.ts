import { Routes } from '@angular/router';
import { PlayGeneratorComponent } from './play-generator/play-generator.component';
import { BacktestResultsComponent } from './backtest-results/backtest-results.component';
import { StepInspectionComponent } from './backtest-results/step-inspection/step-inspection.component';
import { DiffAnalysisPageComponent } from './diff-analysis-page/diff-analysis-page.component';
import { PastePlaysCheckerComponent } from './paste-plays-checker/paste-plays-checker.component';
import { AgentBValidationComponent } from './agent-b-validation/agent-b-validation.component';

export const routes: Routes = [
  { path: 'generator', component: PlayGeneratorComponent },
  { path: 'backtest', component: BacktestResultsComponent },
  { path: 'backtest/inspect', component: StepInspectionComponent },
  { path: 'diff-analysis', component: DiffAnalysisPageComponent },
  { path: 'paste-checker', component: PastePlaysCheckerComponent },
  { path: 'agent-b-validation', component: AgentBValidationComponent },
  { path: '', redirectTo: '/generator', pathMatch: 'full' },
  { path: '**', redirectTo: '/generator' },
];
