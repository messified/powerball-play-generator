import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AgGridDataTableComponent } from './ag-grid-data-table.component';

describe('AgGridDataTableComponent', () => {
  let component: AgGridDataTableComponent;
  let fixture: ComponentFixture<AgGridDataTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgGridDataTableComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AgGridDataTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
