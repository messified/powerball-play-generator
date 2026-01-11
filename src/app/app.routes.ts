import { Routes } from '@angular/router';
import { PlayGeneratorComponent } from './play-generator/play-generator.component';
import { BacktestResultsComponent } from './backtest-results/backtest-results.component';
import { StepInspectionComponent } from './backtest-results/step-inspection/step-inspection.component';

export const routes: Routes = [
  { path: 'generator', component: PlayGeneratorComponent },
  { path: 'backtest', component: BacktestResultsComponent },
  { path: 'backtest/inspect', component: StepInspectionComponent },
  { path: '', redirectTo: '/generator', pathMatch: 'full' },
  { path: '**', redirectTo: '/generator' },
];
