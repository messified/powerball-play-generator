// ai-powerball.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PowerballConfigService } from './powerball-config.service';

export interface PowerballPredictionResponse {
  white_balls: string[];
  powerball: string;
  meta?: {
    white_freq_top?: [number, number][];   // present if the server returns it
    powerball_freq_top?: [number, number][];
  };
}

export interface GenerateOptions {
  num_tickets?: number;              // default 20
  recency_decay?: number;            // default 0.97
  alpha_smooth?: number;             // default 0.5
  temperature?: number;              // default 1.0
  diversity_min_hamming?: number;    // default 2
  seed?: number;                     // optional for reproducibility
}

export interface BatchTicket {
  full_set: string[];     // ['02','17','...','PB']
  white_balls: string[];  // length 5
  powerball: string;      // '01'..'26'
}

export interface BatchResponse {
  tickets: BatchTicket[];
  meta: {
    requested: number;
    returned: number;
    seed?: number;
    diversity_min_hamming?: number;
  };
}

export interface BacktestRequestBody extends Omit<GenerateOptions, 'num_tickets' | 'diversity_min_hamming'> {
  holdout?: number;        // default 10
  num_tickets?: number;    // how many tickets per step during eval (default 20)
}

export interface BacktestStep {
  step: number;        // index of evaluated draw
  white_hits: number;  // best overlap in whites for that step
  pb_hit: number;      // 0/1 for PB
}

export interface BacktestResponse {
  steps: number;
  summary: { white_hits_sum: number; pb_hits_sum: number };
  detail: BacktestStep[];
}

@Injectable({
  providedIn: 'root',
})
export class AiPowerballService {
  constructor(
    private http: HttpClient,
    private configService: PowerballConfigService
  ) {}

  private get apiUrl(): string {
    return this.configService.get('apiUrl');
  }

  // Existing single-play endpoint (works with the upgraded backend)
  async getAiPrediction(historicalDraws: number[][]): Promise<PowerballPredictionResponse | null> {
    try {
      return await firstValueFrom(
        this.http.post<PowerballPredictionResponse>(`${this.apiUrl}/predict`, {
          historical_draws: historicalDraws,
        })
      );
    } catch (error) {
      console.error('AI prediction request failed', error);
      return null;
    }
  }

  // New: batch generator (weighted random play with diversity)
  async generateBatch(historicalDraws: number[][], opts: GenerateOptions = {}): Promise<BatchResponse | null> {
    try {
      if (!this.apiUrl) {
        throw new Error('API URL is not configured');
      }
      if (!historicalDraws || historicalDraws.length === 0) {
        throw new Error('Historical draws data is required');
      }
      const body = {
        historical_draws: historicalDraws,
        ...opts,
      };
      return await firstValueFrom(
        this.http.post<BatchResponse>(`${this.apiUrl}/generate`, body)
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('AI batch generation failed:', errorMessage, error);
      // Return null to allow fallback to local generation
      return null;
    }
  }

  // New: leakage-safe walk-forward backtest
  async backtest(historicalDraws: number[][], opts: BacktestRequestBody = {}): Promise<BacktestResponse | null> {
    try {
      if (!this.apiUrl) {
        throw new Error('API URL is not configured');
      }
      if (!historicalDraws || historicalDraws.length === 0) {
        throw new Error('Historical draws data is required for backtesting');
      }
      const body = {
        historical_draws: historicalDraws,
        ...opts,
      };
      return await firstValueFrom(
        this.http.post<BacktestResponse>(`${this.apiUrl}/backtest`, body)
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Backtest failed:', errorMessage, error);
      throw new Error(`Backtest failed: ${errorMessage}`);
    }
  }

  // (Optional) still OK to keep your mocked train; backend returns {status:"ok"}
  async trainModel(historicalDraws: number[][]): Promise<string | null> {
    try {
      if (!this.apiUrl) {
        console.warn('API URL is not configured, skipping model training');
        return null;
      }
      if (!historicalDraws || historicalDraws.length === 0) {
        console.warn('No historical draws provided, skipping model training');
        return null;
      }
      const res = await firstValueFrom(
        this.http.post<{ status: string }>(`${this.apiUrl}/train`, {
          historical_draws: historicalDraws,
        })
      );
      return res.status;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Model training failed:', errorMessage, error);
      // Return null to allow app to continue without training
      return null;
    }
  }
}
