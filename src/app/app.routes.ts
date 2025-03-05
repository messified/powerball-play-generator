import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { PlayGeneratorComponent } from './play-generator/play-generator.component';

export const routes: Routes = [
    { path: 'generator', component: PlayGeneratorComponent},
    { path: 'dashboard', component: DashboardComponent },
];
