import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Centralized configuration interface for Powerball generation services.
 * All thresholds, recency bases, and other parameters are managed here.
 */
export interface PowerballConfig {
  // Number ranges
  whiteBallRange: { min: number; max: number };
  powerballRange: { min: number; max: number };

  // Duplicate thresholds
  whiteBallDupThreshold: number;
  powerballDupThreshold: number;

  // Recency weighting
  recencyExpBase: number;
  recencyThreshold: number;

  // Generation parameters
  randomOffsetChance: number;
  maxUniquenessAttempts: number;
  minFrequencyThreshold: number;

  // Data filtering
  fromDate: Date;

  // Logging
  logsEnabled: boolean;

  // API configuration
  apiUrl: string;

  // Component-level configuration
  generation: {
    counter: number;
    pastDrawingCount: number;
  };

  // ML/AI batch generation defaults
  mlGeneration: {
    numTickets: number;
    diversityMinHamming: number;
    recencyDecay: number;
    alphaSmooth: number;
    temperature: number;
  };

  // Target win optimization
  targetWinOptimization: {
    enabled: boolean;
    targetType: 'fourWhite' | 'threeWhitePowerball' | 'both';
    patternAnalysisWindow: number; // How many historical draws to analyze
    coOccurrenceThreshold: number; // Minimum frequency for pattern inclusion
  };
}

/**
 * Centralized configuration service for Powerball generation.
 * Provides a single source of truth for all configuration parameters.
 */
@Injectable({
  providedIn: 'root',
})
export class PowerballConfigService {
  private config: PowerballConfig = {
    // Number ranges
    whiteBallRange: { min: 1, max: 69 },
    powerballRange: { min: 1, max: 26 },

    // Duplicate thresholds
    // Note: Different services may use different thresholds
    // This is the default; services can override if needed
    whiteBallDupThreshold: 4,
    powerballDupThreshold: 4,

    // Recency weighting
    // Standardized to 1.051 (can be adjusted based on testing)
    recencyExpBase: 1.051,
    recencyThreshold: 50,

    // Generation parameters
    randomOffsetChance: 0.1, // 10% chance of random override
    maxUniquenessAttempts: 20,
    minFrequencyThreshold: 5,

    // Data filtering
    fromDate: new Date('2019-01-04T00:00:00'),

    // Logging
    logsEnabled: false,

    // API configuration
    // Can be overridden via environment variables or build-time configuration
    apiUrl: this.getApiUrl(),

    // Component-level configuration
    generation: {
      counter: 20,
      pastDrawingCount: 200,
    },

    // ML/AI batch generation defaults
    mlGeneration: {
      numTickets: 60,
      diversityMinHamming: 8,
      recencyDecay: 0.98,
      alphaSmooth: 0.5,
      temperature: 0.9,
    },

    // Target win optimization
    targetWinOptimization: {
      enabled: false,
      targetType: 'both',
      patternAnalysisWindow: 200, // Analyze last 200 draws for patterns
      coOccurrenceThreshold: 2, // Minimum frequency for pattern inclusion
    },
  };

  constructor() {}

  /**
   * Gets the API URL from environment configuration.
   * Falls back to localhost for development if not configured.
   */
  private getApiUrl(): string {
    return environment.apiUrl || 'http://localhost:8000';
  }

  /**
   * Returns the complete configuration object.
   */
  getConfig(): PowerballConfig {
    return { ...this.config };
  }

  /**
   * Returns a specific configuration value.
   */
  get<K extends keyof PowerballConfig>(key: K): PowerballConfig[K] {
    return this.config[key];
  }

  /**
   * Updates a configuration value.
   * Useful for runtime configuration changes.
   */
  set<K extends keyof PowerballConfig>(key: K, value: PowerballConfig[K]): void {
    this.config[key] = value;
  }

  /**
   * Updates multiple configuration values at once.
   */
  updateConfig(updates: Partial<PowerballConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Gets configuration for a specific service.
   * Allows services to have service-specific overrides if needed.
   */
  getServiceConfig(serviceName: 'powerball' | 'prediction'): Partial<PowerballConfig> {
    const baseConfig = this.getConfig();
    
    if (serviceName === 'prediction') {
      // PredictionService uses different thresholds
      return {
        ...baseConfig,
        whiteBallDupThreshold: 6,
        recencyExpBase: 1.055,
      };
    }
    
    return baseConfig;
  }
}
