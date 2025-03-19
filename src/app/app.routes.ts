import { Routes } from '@angular/router';
import { PlayGeneratorComponent } from './play-generator/play-generator.component';

export const routes: Routes = [
  { path: 'generator', component: PlayGeneratorComponent },
  { path: '', redirectTo: '/generator', pathMatch: 'full' },
  { path: '**', redirectTo: '/generator' },
];
