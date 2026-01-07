import { Injectable } from '@angular/core';
import { GenerationStrategy } from './generation-strategy.interface';
import { InitialRandomStrategy } from './initial-random-strategy';
import { PredictiveFrequencyStrategy } from './predictive-frequency-strategy';
import { PredictiveWeightedRandomStrategy } from './predictive-weighted-random-strategy';
import { HighestProbabilityStrategy } from './highest-probability-strategy';
import { AiPredictiveStrategy } from './ai-predictive-strategy';
import { HigherOrderMarkovStrategy } from './higher-order-markov-strategy';

/**
 * Factory service for creating and managing generation strategies.
 * Provides a centralized way to access all available strategies.
 */
@Injectable({
  providedIn: 'root',
})
export class StrategyFactoryService {
  private strategies: Map<string, GenerationStrategy> = new Map();

  constructor(
    private initialRandomStrategy: InitialRandomStrategy,
    private predictiveFrequencyStrategy: PredictiveFrequencyStrategy,
    private predictiveWeightedRandomStrategy: PredictiveWeightedRandomStrategy,
    private highestProbabilityStrategy: HighestProbabilityStrategy,
    private aiPredictiveStrategy: AiPredictiveStrategy,
    private higherOrderMarkovStrategy: HigherOrderMarkovStrategy
  ) {
    this.registerStrategies();
  }

  /**
   * Registers all available strategies.
   */
  private registerStrategies(): void {
    this.strategies.set('initialRandom', this.initialRandomStrategy);
    this.strategies.set('predictiveFrequency', this.predictiveFrequencyStrategy);
    this.strategies.set('predictiveWeightedRandom', this.predictiveWeightedRandomStrategy);
    this.strategies.set('highestProbability', this.highestProbabilityStrategy);
    this.strategies.set('aiPredictive', this.aiPredictiveStrategy);
    this.strategies.set('higherOrderMarkov', this.higherOrderMarkovStrategy);
  }

  /**
   * Gets a strategy by name.
   */
  getStrategy(name: string): GenerationStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * Gets all available strategy names.
   */
  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Gets all registered strategies.
   */
  getAllStrategies(): Map<string, GenerationStrategy> {
    return new Map(this.strategies);
  }
}
