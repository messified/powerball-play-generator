import { Component, OnInit } from '@angular/core';
import { ColDef, GridReadyEvent, ICellRendererParams } from 'ag-grid-community';
import { AgGridModule } from 'ag-grid-angular';
import { chartData } from '../data/chart-data';
import { PickCheckerService } from '../services/pick-checker.service';
import { Win } from '../models/powerball-draw.interface';

// Define an interface for our flattened row data
export interface ChartEntry {
  date: string;
  historical_draw: string[];
  matching_picks_count: number;
  matching_picks: string[][];
  multiplier: string;
  month: string;
  year: string;
}

@Component({
  selector: 'app-ag-grid-data-table',
  standalone: true,
  imports: [AgGridModule],
  templateUrl: './ag-grid-data-table.component.html',
  styleUrl: './ag-grid-data-table.component.scss',
})
export class AgGridDataTableComponent implements OnInit {
  constructor(private pickCheckerService: PickCheckerService) {}

  flattenedData: ChartEntry[] = [];

  // Define column definitions including all columns
  columnDefs: ColDef[] = [
    {
      headerName: 'Date',
      field: 'date',
      cellRenderer: (params: ICellRendererParams) => new Date(params.value as string).toLocaleDateString(),
    },
    {
      headerName: 'Historical Draw',
      field: 'historical_draw',
      cellRenderer: (params: ICellRendererParams) =>
        params.value ? (params.value as string[]).join(', ') : '',
    },
    {
      headerName: 'Matching Picks',
      field: 'matching_picks',
      cellRenderer: (params: ICellRendererParams) => {
        if (!params.value) {
          return '';
        }
        // For each matching pick (which is an array), join the numbers with a comma,
        // then join the inner arrays with a " | " separator.
        return (params.value as string[][]).map((arr: string[]) => arr.join(', ')).join(' | ');
      },
    },
  ];

  // Default column properties for sorting, filtering, and resizing
  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
  };

  // When the grid is ready, adjust column sizes
  onGridReady(params: GridReadyEvent): void {
    params.api.sizeColumnsToFit();
  }

  ngOnInit(): void {
    this.pickCheckerService.barChartData$.subscribe((chartData: Array<Record<string, Win[]>> = []) => {
      // Flatten the nested chartData structure into a simple array.
      // Each top-level object contains keys (e.g., 'December', 'August', etc.)
      // whose values are arrays of ChartEntry objects.
      this.flattenedData = [];
      chartData.forEach((item: Record<string, Win[]>) => {
        Object.keys(item).forEach((key) => {
          const entries = item[key] as ChartEntry[];
          this.flattenedData.push(...entries);
        });
      });
    });
  }
}
