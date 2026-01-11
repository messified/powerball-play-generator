import { Injectable } from '@angular/core';
import { GenerationStrategy, GenerationContext } from './generation-strategy.interface';
import { TargetWinPatternService, WhiteBallPatternMap, WhitePowerballPatternMap } from '../target-win-pattern.service';
import { PowerballConfigService } from '../powerball-config.service';
import { PowerballData } from '../../data/powerball-data';
import { PowerballDraw } from '../../models/powerball-draw.interface';

/**
 * Pattern maps combined for scoring
 */
interface PatternMaps {
  fourWhite: WhiteBallPatternMap;
  threeWhitePowerball: WhitePowerballPatternMap;
}

/**
 * Target Win Strategy
 * 
 * Generates plays optimized for specific win conditions:
 * - 4 white ball matches
 * - 3 white ball matches + powerball match
 * 
 * Uses pattern analysis to identify high-probability co-occurrences
 * and conditional probabilities to guide number selection.
 */
@Injectable({
  providedIn: 'root',
})
export class TargetWinStrategy implements GenerationStrategy {
  private readonly NUM_CANDIDATES = 10; // Number of candidate plays to generate and score
  private readonly CO_OCCURRENCE_THRESHOLD = 2; // Minimum frequency for pattern inclusion

  constructor(
    private patternService: TargetWinPatternService,
    private configService: PowerballConfigService
  ) {}

  getName(): string {
    return 'Target Win Optimization';
  }

  async generate(context: GenerationContext): Promise<string[]> {
    // Convert historical data to PowerballDraw format
    const historicalDraws = this.convertToPowerballDraws(context.historicalData);
    
    // Analyze patterns for both target win conditions
    const fourWhitePatterns = this.patternService.analyzeFourWhitePatterns(historicalDraws);
    const threeWhitePowerballPatterns = this.patternService.analyzeThreeWhitePowerballPatterns(historicalDraws);
    
    const patterns: PatternMaps = {
      fourWhite: fourWhitePatterns,
      threeWhitePowerball: threeWhitePowerballPatterns,
    };

    // Get target type from config (default to 'both')
    const targetType = this.getTargetType();
    
    // Generate multiple candidate plays
    const candidates: Array<{ play: string[]; score: number }> = [];
    
    for (let i = 0; i < this.NUM_CANDIDATES; i++) {
      let candidatePlay: string[];
      
      if (targetType === 'fourWhite') {
        candidatePlay = this.generateFourWhiteOptimizedPlay(patterns, context);
      } else if (targetType === 'threeWhitePowerball') {
        candidatePlay = this.generateThreeWhitePowerballOptimizedPlay(patterns, context);
      } else {
        // 'both' - alternate or combine strategies
        if (i % 2 === 0) {
          candidatePlay = this.generateFourWhiteOptimizedPlay(patterns, context);
        } else {
          candidatePlay = this.generateThreeWhitePowerballOptimizedPlay(patterns, context);
        }
      }
      
      const score = this.scorePlayForTargetWins(candidatePlay, patterns, targetType);
      candidates.push({ play: candidatePlay, score });
    }

    // Return the highest-scoring play
    candidates.sort((a, b) => b.score - a.score);
    const bestPlay = candidates[0].play;
    
    return context.sortGeneratedSet(bestPlay);
  }

  /**
   * Generates a play optimized for 4 white ball matches.
   * Selects 4 white balls from high-frequency co-occurrence groups,
   * then adds a 5th using synergy.
   */
  private generateFourWhiteOptimizedPlay(
    patterns: PatternMaps,
    context: GenerationContext
  ): string[] {
    // Get optimal white ball groups (quadruplets)
    const optimalGroups = this.patternService.getOptimalWhiteBallGroups(4);
    
    // Filter groups by co-occurrence threshold
    const filteredGroups = optimalGroups.filter(group => {
      const combo = group.sort().join(',');
      const frequency = patterns.fourWhite.quadrupletFrequencies.get(combo) || 0;
      return frequency >= this.CO_OCCURRENCE_THRESHOLD;
    });

    let whiteBalls: string[];
    
    if (filteredGroups.length > 0) {
      // Select from top groups (weighted by frequency)
      const selectedGroup = this.selectWeightedGroup(filteredGroups, patterns.fourWhite.quadrupletFrequencies);
      whiteBalls = [...selectedGroup];
      
      // Add 5th white ball using synergy with the selected group
      const fifthBall = this.selectSynergyBall(whiteBalls, context);
      whiteBalls.push(fifthBall);
    } else {
      // Fallback: use top triplets and add 2 more
      const triplets = this.patternService.getOptimalWhiteBallGroups(3);
      if (triplets.length > 0) {
        const selectedTriplet = this.selectWeightedGroup(triplets, patterns.fourWhite.tripletFrequencies);
        whiteBalls = [...selectedTriplet];
        
        // Add 4th and 5th using synergy
        const fourthBall = this.selectSynergyBall(whiteBalls, context);
        whiteBalls.push(fourthBall);
        const fifthBall = this.selectSynergyBall(whiteBalls, context);
        whiteBalls.push(fifthBall);
      } else {
        // Ultimate fallback: use context helper methods
        whiteBalls = this.generateFallbackWhites(context);
      }
    }

    // Ensure we have exactly 5 unique white balls
    whiteBalls = this.ensureUniqueWhites(whiteBalls, context);
    
    // Select powerball (use AI pick or weighted random)
    const powerball = context.pickPowerballAi();
    
    return [...whiteBalls, powerball];
  }

  /**
   * Generates a play optimized for 3 white + powerball matches.
   * Selects 3 white balls from patterns, then chooses powerball
   * based on conditional probability with those whites.
   */
  private generateThreeWhitePowerballOptimizedPlay(
    patterns: PatternMaps,
    context: GenerationContext
  ): string[] {
    // Get optimal white ball groups (triplets)
    const optimalGroups = this.patternService.getOptimalWhiteBallGroups(3);
    
    // Filter groups by co-occurrence threshold
    const filteredGroups = optimalGroups.filter(group => {
      const combo = group.sort().join(',');
      const frequency = patterns.fourWhite.tripletFrequencies.get(combo) || 0;
      return frequency >= this.CO_OCCURRENCE_THRESHOLD;
    });

    let whiteBalls: string[];
    
    if (filteredGroups.length > 0) {
      // Select from top groups (weighted by frequency)
      const selectedGroup = this.selectWeightedGroup(filteredGroups, patterns.fourWhite.tripletFrequencies);
      whiteBalls = [...selectedGroup];
    } else {
      // Fallback: use pairs and add one more
      const pairs = Array.from(patterns.fourWhite.pairFrequencies.entries())
        .filter(([_, freq]) => freq >= this.CO_OCCURRENCE_THRESHOLD)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([combo]) => combo.split(','));
      
      if (pairs.length > 0) {
        const selectedPair = pairs[Math.floor(Math.random() * Math.min(3, pairs.length))];
        whiteBalls = [...selectedPair];
        const thirdBall = this.selectSynergyBall(whiteBalls, context);
        whiteBalls.push(thirdBall);
      } else {
        // Ultimate fallback
        whiteBalls = this.generateFallbackWhites(context).slice(0, 3);
      }
    }

    // Add 4th and 5th white balls using synergy
    while (whiteBalls.length < 5) {
      const nextBall = this.selectSynergyBall(whiteBalls, context);
      whiteBalls.push(nextBall);
    }

    // Ensure we have exactly 5 unique white balls
    whiteBalls = this.ensureUniqueWhites(whiteBalls, context);
    
    // Select powerball based on conditional probability with the 3 white balls
    const optimalPowerballs = this.patternService.getOptimalPowerballForWhites(whiteBalls.slice(0, 3));
    
    let powerball: string;
    if (optimalPowerballs.length > 0) {
      // Weighted selection from top powerballs
      const topPowerballs = optimalPowerballs.slice(0, 5);
      powerball = topPowerballs[Math.floor(Math.random() * topPowerballs.length)];
    } else {
      // Fallback to AI pick
      powerball = context.pickPowerballAi();
    }
    
    return [...whiteBalls, powerball];
  }

  /**
   * Scores a play based on how well it matches target win patterns.
   * Higher scores indicate better alignment with historical patterns.
   */
  private scorePlayForTargetWins(
    play: string[],
    patterns: PatternMaps,
    targetType: 'fourWhite' | 'threeWhitePowerball' | 'both'
  ): number {
    if (play.length < 6) return 0;
    
    const whiteBalls = play.slice(0, 5).map(b => b.padStart(2, '0')).sort();
    const powerball = play[5].padStart(2, '0');
    
    let score = 0;
    
    if (targetType === 'fourWhite' || targetType === 'both') {
      // Score based on quadruplet frequency
      const quadruplet = whiteBalls.join(',');
      const quadFreq = patterns.fourWhite.quadrupletFrequencies.get(quadruplet) || 0;
      score += quadFreq * 10; // Weight quadruplets heavily
      
      // Score based on triplet frequencies within the play
      for (let i = 0; i < whiteBalls.length; i++) {
        for (let j = i + 1; j < whiteBalls.length; j++) {
          for (let k = j + 1; k < whiteBalls.length; k++) {
            const triplet = [whiteBalls[i], whiteBalls[j], whiteBalls[k]].sort().join(',');
            const tripFreq = patterns.fourWhite.tripletFrequencies.get(triplet) || 0;
            score += tripFreq * 2;
          }
        }
      }
      
      // Score based on pair frequencies
      for (let i = 0; i < whiteBalls.length; i++) {
        for (let j = i + 1; j < whiteBalls.length; j++) {
          const pair = [whiteBalls[i], whiteBalls[j]].sort().join(',');
          const pairFreq = patterns.fourWhite.pairFrequencies.get(pair) || 0;
          score += pairFreq;
        }
      }
    }
    
    if (targetType === 'threeWhitePowerball' || targetType === 'both') {
      // Score based on conditional probability of powerball given white balls
      const topThree = whiteBalls.slice(0, 3).sort().join(',');
      const probMap = patterns.threeWhitePowerball.whiteToPowerball.get(topThree);
      
      if (probMap) {
        const powerballProb = probMap.get(powerball) || 0;
        score += powerballProb * 100; // Weight conditional probability heavily
      }
      
      // Also consider all triplets in the play
      for (let i = 0; i < whiteBalls.length; i++) {
        for (let j = i + 1; j < whiteBalls.length; j++) {
          for (let k = j + 1; k < whiteBalls.length; k++) {
            const triplet = [whiteBalls[i], whiteBalls[j], whiteBalls[k]].sort().join(',');
            const probMap = patterns.threeWhitePowerball.whiteToPowerball.get(triplet);
            if (probMap) {
              const powerballProb = probMap.get(powerball) || 0;
              score += powerballProb * 20;
            }
          }
        }
      }
    }
    
    return score;
  }

  /**
   * Selects a white ball group weighted by frequency.
   */
  private selectWeightedGroup(
    groups: string[][],
    frequencyMap: Map<string, number>
  ): string[] {
    if (groups.length === 0) return [];
    
    // Get frequencies for all groups
    const groupScores = groups.map(group => {
      const combo = group.sort().join(',');
      return {
        group,
        frequency: frequencyMap.get(combo) || 0,
      };
    });
    
    // Sort by frequency (descending)
    groupScores.sort((a, b) => b.frequency - a.frequency);
    
    // Take top 3 and randomly select from them (weighted by frequency)
    const topGroups = groupScores.slice(0, 3);
    const totalFreq = topGroups.reduce((sum, g) => sum + g.frequency, 0);
    
    if (totalFreq === 0) {
      return topGroups[0].group;
    }
    
    let random = Math.random() * totalFreq;
    for (const { group, frequency } of topGroups) {
      random -= frequency;
      if (random <= 0) {
        return group;
      }
    }
    
    return topGroups[0].group;
  }

  /**
   * Selects a white ball that has good synergy with existing white balls.
   */
  private selectSynergyBall(existingBalls: string[], context: GenerationContext): string {
    // Use synergy map to find numbers that frequently follow the last ball
    const lastBall = existingBalls[existingBalls.length - 1];
    const positionIndex = Math.min(existingBalls.length - 1, 3);
    
    const synergyData = context.synergyMap[positionIndex]?.[lastBall];
    
    if (synergyData && Object.keys(synergyData).length > 0) {
      // Get candidates from synergy map
      const candidates = Object.keys(synergyData)
        .filter(b => !existingBalls.includes(b.padStart(2, '0')))
        .map(b => b.padStart(2, '0'));
      
      if (candidates.length > 0) {
        // Weight by frequency
        const weightedCandidates: string[] = [];
        for (const candidate of candidates) {
          const freq = synergyData[candidate] || 0;
          for (let i = 0; i < freq; i++) {
            weightedCandidates.push(candidate);
          }
        }
        
        if (weightedCandidates.length > 0) {
          return weightedCandidates[Math.floor(Math.random() * weightedCandidates.length)];
        }
      }
    }
    
    // Fallback: use context helper
    const allNumbers = Array.from({ length: 69 }, (_, i) => (i + 1).toString().padStart(2, '0'));
    const available = allNumbers.filter(b => !existingBalls.includes(b));
    
    if (available.length > 0) {
      return context.pickAdvancedProbabilityNumber(available);
    }
    
    // Ultimate fallback
    return context.randomNumberInRange(1, 69);
  }

  /**
   * Ensures all white balls are unique and within valid range.
   */
  private ensureUniqueWhites(whiteBalls: string[], context: GenerationContext): string[] {
    const unique = new Set<string>();
    const result: string[] = [];
    const config = this.configService.getConfig();
    
    for (const ball of whiteBalls) {
      const normalized = ball.padStart(2, '0');
      const num = parseInt(normalized, 10);
      
      if (
        !unique.has(normalized) &&
        num >= config.whiteBallRange.min &&
        num <= config.whiteBallRange.max
      ) {
        unique.add(normalized);
        result.push(normalized);
      }
    }
    
    // Fill up to 5 if needed
    while (result.length < 5) {
      const candidate = context.randomNumberInRange(
        config.whiteBallRange.min,
        config.whiteBallRange.max
      );
      const normalized = candidate.padStart(2, '0');
      
      if (!unique.has(normalized)) {
        unique.add(normalized);
        result.push(normalized);
      }
    }
    
    return result.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }

  /**
   * Generates fallback white balls using context helper methods.
   */
  private generateFallbackWhites(context: GenerationContext): string[] {
    const fallback = context.generateFallbackSet();
    return fallback.slice(0, 5);
  }

  /**
   * Gets target type from config or returns default.
   */
  private getTargetType(): 'fourWhite' | 'threeWhitePowerball' | 'both' {
    try {
      const config = this.configService.getConfig();
      // Check if targetWinOptimization config exists
      if (config.targetWinOptimization && config.targetWinOptimization.enabled) {
        return config.targetWinOptimization.targetType;
      }
      return 'both';
    } catch {
      return 'both';
    }
  }

  /**
   * Converts historical data from string[][] format to PowerballDraw[] format.
   */
  private convertToPowerballDraws(historicalData: string[][]): PowerballDraw[] {
    // If we can't convert from historicalData, use PowerballData directly
    // This is a fallback - ideally historicalData should be available
    if (!historicalData || historicalData.length === 0) {
      return PowerballData;
    }
    
    // Convert string[][] to PowerballDraw[]
    // We'll use a synthetic date since we don't have real dates
    return historicalData.map((draw, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (historicalData.length - index));
      
      return {
        draw_date: date.toISOString(),
        winning_numbers: draw.join(' '),
        multiplier: '1',
      };
    });
  }
}
