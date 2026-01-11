import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BacktestResultsComponent } from './backtest-results.component';
import { BacktestService } from '../services/backtest.service';
import { of, throwError } from 'rxjs';

describe('BacktestResultsComponent', () => {
  let component: BacktestResultsComponent;
  let fixture: ComponentFixture<BacktestResultsComponent>;
  let backtestService: jasmine.SpyObj<BacktestService>;

  beforeEach(async () => {
    const backtestServiceSpy = jasmine.createSpyObj('BacktestService', [
      'runBacktest',
      'exportToJson',
    ]);

    await TestBed.configureTestingModule({
      imports: [BacktestResultsComponent],
      providers: [{ provide: BacktestService, useValue: backtestServiceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(BacktestResultsComponent);
    component = fixture.componentInstance;
    backtestService = TestBed.inject(BacktestService) as jasmine.SpyObj<BacktestService>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
