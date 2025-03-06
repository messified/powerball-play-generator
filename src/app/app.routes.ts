import { Routes } from '@angular/router';
import { PlayGeneratorComponent } from './play-generator/play-generator.component';

export const routes: Routes = [
    { path: 'generator', component: PlayGeneratorComponent },
    // Optionally, redirect the empty path to wins-chart:
    { path: '', redirectTo: '/generator', pathMatch: 'full' },
    // Add a wildcard route if needed:
    { path: '**', redirectTo: '/generator' }
  ];
