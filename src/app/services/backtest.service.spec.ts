import { TestBed } from '@angular/core/testing';
import { BacktestService } from './backtest.service';
import { PowerballService } from './powerball.service';
import { PredictionService } from './prediction.service';
import { AiPowerballService } from './ai-powerball.service';
import { PowerballConfigService } from './powerball-config.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('BacktestService', () => {
  let service: BacktestService;
  let powerballService: jasmine.SpyObj<PowerballService>;
  let predictionService: jasmine.SpyObj<PredictionService>;
  let aiService: jasmine.SpyObj<AiPowerballService>;
  let configService: PowerballConfigService;

  beforeEach(() => {
    const powerballSpy = jasmine.createSpyObj('PowerballService', ['generatePowerballPlay']);
    const predictionSpy = jasmine.createSpyObj('PredictionService', ['generatePowerballPlay']);
    const aiSpy = jasmine.createSpyObj('AiPowerballService', ['generateBatch']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        BacktestService,
        { provide: PowerballService, useValue: powerballSpy },
        { provide: PredictionService, useValue: predictionSpy },
        { provide: AiPowerballService, useValue: aiSpy },
        PowerballConfigService,
      ],
    });

    service = TestBed.inject(BacktestService);
    powerballService = TestBed.inject(PowerballService) as jasmine.SpyObj<PowerballService>;
    predictionService = TestBed.inject(PredictionService) as jasmine.SpyObj<PredictionService>;
    aiService = TestBed.inject(AiPowerballService) as jasmine.SpyObj<AiPowerballService>;
    configService = TestBed.inject(PowerballConfigService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('evaluateMatch', () => {
    it('should correctly count white ball matches', () => {
      const predictions = [
        ['01', '02', '03', '04', '05', '10'],
        ['06', '07', '08', '09', '10', '15'],
      ];
      const actualDraw = {
        draw_date: '2025-01-01',
        winning_numbers: '01 02 03 04 05 10',
        multiplier: '2',
      };

      const result = (service as any).evaluateMatch(predictions, actualDraw);

      expect(result.whiteHits).toBe(5);
      expect(result.powerballHit).toBe(true);
    });

    it('should find the best match across multiple tickets', () => {
      const predictions = [
        ['01', '02', '03', '04', '05', '10'],
        ['01', '02', '03', '04', '06', '10'],
        ['10', '11', '12', '13', '14', '15'],
      ];
      const actualDraw = {
        draw_date: '2025-01-01',
        winning_numbers: '01 02 03 04 05 10',
        multiplier: '2',
      };

      const result = (service as any).evaluateMatch(predictions, actualDraw);

      expect(result.whiteHits).toBe(5);
      expect(result.powerballHit).toBe(true);
    });
  });

  describe('formatResultsForConsole', () => {
    it('should format results correctly', () => {
      const mockResult = {
        config: {
          initialTrainingSize: 100,
          stepSize: 1,
          holdoutSize: 1,
          strategies: ['legacy'],
          ticketsPerStrategy: 20,
        },
        summary: {
          totalSteps: 10,
          strategies: {
            legacy: {
              totalWhiteHits: 15,
              totalPowerballHits: 2,
              averageWhiteHits: 1.5,
              averagePowerballHits: 0.2,
              bestWhiteHits: 3,
              worstWhiteHits: 0,
              perfectMatches: 0,
              nearMisses: 1,
            },
          },
          overallMetrics: {
            totalPredictions: 10,
            averageTicketsPerStep: 20,
            totalTestDraws: 10,
          },
        },
        stepResults: [],
      };

      const output = service.formatResultsForConsole(mockResult as any);

      expect(output).toContain('BACKTEST RESULTS');
      expect(output).toContain('Initial Training Size: 100');
      expect(output).toContain('Total Steps: 10');
      expect(output).toContain('LEGACY');
      expect(output).toContain('Average White Hits: 1.50');
    });
  });
});
