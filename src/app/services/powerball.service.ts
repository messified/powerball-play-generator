import { Injectable } from '@angular/core';
import { PowerballData } from '../data/powerball-data';
import _ from 'lodash';
import { FutureGeneratedDraws } from '../data/future-data';
import { PowerballDataMinusLatest } from '../data/historical-data';
import { PowerballConfigService } from './powerball-config.service';
import { GenerationContext } from './strategies/generation-strategy.interface';
import { StrategyFactoryService } from './strategies/strategy-factory.service';
import { 
  PowerballDraw, 
  ParsedPowerballDraw, 
  PowerballNumberSet, 
  FilteredNumberSet,
  GeneratedPlay,
  RecentDrawing,
  FutureTestData,
  DiffPatternAnalysis
} from '../models/powerball-draw.interface';

@Injectable({
  providedIn: 'root',
})
export class PowerballService {
  private powerballData: PowerballDraw[] = [];
  private historicalData: string[][] = [];

  /**
   * synergyMap[positionIndex][currentNumber][nextNumber] = frequency
   */
  private synergyMap: {
    [positionIndex: number]: {
      [currentNum: string]: { [nextNum: string]: number };
    };
  } = {};

  constructor(
    private configService: PowerballConfigService,
    private strategyFactory: StrategyFactoryService
  ) {}

  // ------------------------------------------------------------
  // MAIN ENTRY
  // ------------------------------------------------------------

  async generatePowerballPlay(trainingData?: PowerballDraw[]): Promise<GeneratedPlay> {
    try {
      // 1. Load historical data
      // If trainingData is provided (for backtesting), use it; otherwise use default
      this.powerballData = trainingData || PowerballDataMinusLatest;

      if (!this.powerballData || this.powerballData.length === 0) {
        throw new Error('No historical data available for generation');
      }

      // 2. Filter based on fromDate
      const fromDate = this.configService.get('fromDate');
      const filtered = this.powerballData.filter(
        (el: PowerballDraw) => {
          try {
            const drawDate = new Date(el.draw_date);
            return drawDate >= fromDate;
          } catch (error) {
            console.warn('Invalid date format in draw:', el.draw_date);
            return false;
          }
        }
      );

      if (filtered.length === 0) {
        throw new Error('No data available after filtering by date');
      }

      // 3. Map the filtered data
      const formattedData: ParsedPowerballDraw[] = filtered.map(
        (result: PowerballDraw) => ({
          date: result.draw_date,
          numbers: result.winning_numbers.split(' '),
          multiplier: result.multiplier || '1',
        })
      );

      // 4. Parse winning numbers
      const parsedsets = await this.parseWinningNumbers(formattedData);

      // 5. Filter duplicates/frequencies
      const filteredParsedSets = await this.filterParsedNumberSets(parsedsets);

      if (!filteredParsedSets || filteredParsedSets.length === 0) {
        throw new Error('No valid number sets after filtering');
      }

      // 6. Build generation context
      const context = this.buildGenerationContext(filteredParsedSets);

      // 7. Generate plays using strategies
      const initialRandomStrategy = this.strategyFactory.getStrategy('initialRandom');
      const predictiveFrequencyStrategy = this.strategyFactory.getStrategy('predictiveFrequency');
      const predictiveWeightedRandomStrategy = this.strategyFactory.getStrategy('predictiveWeightedRandom');
      const highestProbabilityStrategy = this.strategyFactory.getStrategy('highestProbability');
      const aiPredictiveStrategy = this.strategyFactory.getStrategy('aiPredictive');

      if (!initialRandomStrategy || !predictiveFrequencyStrategy || !predictiveWeightedRandomStrategy || 
          !highestProbabilityStrategy || !aiPredictiveStrategy) {
        throw new Error('One or more generation strategies are not available');
      }

      // Generate all plays in parallel for better performance
      const [
        sortedInitialPlay,
        sortedPredictiveFreqPredictedPlay,
        sortedPredictiveWeightedRandomPlay,
        sortedHighestProbabilityPlay,
        sortedAiPredictiveSet
      ] = await Promise.all([
        initialRandomStrategy.generate(context).catch(err => {
          console.error('Error in initialRandom strategy:', err);
          return this.generateFallbackSet();
        }),
        predictiveFrequencyStrategy.generate(context).catch(err => {
          console.error('Error in predictiveFrequency strategy:', err);
          return this.generateFallbackSet();
        }),
        predictiveWeightedRandomStrategy.generate(context).catch(err => {
          console.error('Error in predictiveWeightedRandom strategy:', err);
          return this.generateFallbackSet();
        }),
        highestProbabilityStrategy.generate(context).catch(err => {
          console.error('Error in highestProbability strategy:', err);
          return this.generateFallbackSet();
        }),
        aiPredictiveStrategy.generate(context).catch(err => {
          console.error('Error in aiPredictive strategy:', err);
          return this.generateFallbackSet();
        })
      ]);

      return {
        initialPlay: Array.isArray(sortedInitialPlay) ? sortedInitialPlay : [],
        predictiveFreqPredictedPlay: Array.isArray(sortedPredictiveFreqPredictedPlay) ? sortedPredictiveFreqPredictedPlay : [],
        predictiveWeightedRandomPlay: Array.isArray(sortedPredictiveWeightedRandomPlay) ? sortedPredictiveWeightedRandomPlay : [],
        highestProbabilityPlay: Array.isArray(sortedHighestProbabilityPlay) ? sortedHighestProbabilityPlay : [],
        aiPredictiveSet: Array.isArray(sortedAiPredictiveSet) ? sortedAiPredictiveSet : [],
      };
    } catch (error) {
      console.error('Error generating Powerball play:', error);
      // Return fallback plays if generation fails
      const fallback = this.generateFallbackSet();
      return {
        initialPlay: fallback,
        predictiveFreqPredictedPlay: fallback,
        predictiveWeightedRandomPlay: fallback,
        highestProbabilityPlay: fallback,
        aiPredictiveSet: fallback,
      };
    }
  }

  /**
   * Builds the generation context that strategies need to generate plays.
   * 
   * @param filteredParsedSets - Filtered parsed number sets
   * @param diffPatterns - Optional diff pattern analysis for pattern-based strategies
   */
  private buildGenerationContext(
    filteredParsedSets: Array<{ key: string; numbers: number[] }>,
    diffPatterns?: DiffPatternAnalysis
  ): GenerationContext {
    return {
      historicalData: this.historicalData,
      filteredParsedSets: filteredParsedSets,
      synergyMap: this.synergyMap,
      pickAdvancedProbabilityNumber: (bestGuessSet: string[]) => this.pickAdvancedProbabilityNumber(bestGuessSet),
      pickAdvancedProbabilityNumberWithRecency: (bestGuessSet: string[], recencyThreshold: number) => 
        this.pickAdvancedProbabilityNumberWithRecency(bestGuessSet, recencyThreshold),
      pickMostFrequentFirstNumber: (powerball?: boolean) => this.pickMostFrequentFirstNumber(powerball),
      pickWeightedRandomFirstNumber: (powerball?: boolean) => this.pickWeightedRandomFirstNumber(powerball),
      generateNextNumberArray: (selectedNumber: string, customIndex?: number) => 
        this.generateNextNumberArray(selectedNumber, customIndex),
      randomNumberInRange: (min: number, max: number) => this.randomNumberInRange(min, max),
      buildWithTheFirst: (firstPredictedNumber: string, initialPlay: string[]) =>
        this.buildWithTheFirst(firstPredictedNumber, initialPlay),
      pickPowerballAi: () => this.pickPowerballAi(),
      generateFallbackSet: () => this.generateFallbackSet(),
      sortGeneratedSet: (generated: string[] | string[][]) => {
        const result = this.sortGeneratedSet(generated);
        // Strategies expect string[] back, so if we get string[][], return the first array
        // This handles the case where a strategy passes string[] but the method might return string[][]
        if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
          return (result as string[][])[0];
        }
        return result as string[];
      },
      diffPatterns: diffPatterns,
    };
  }

  /**
   * Generates synthetic future draws that mimic your historical data approach.
   *
   * @param count - How many future draws to generate.
   * @param startDate - An optional starting Date to begin "future draws."
   *                    Defaults to today's date if omitted.
   * @returns An array of objects shaped like your historical data, e.g.:
   *   {
   *     draw_date: '2026-03-10T00:00:00.000',
   *     winning_numbers: '07 14 23 55 63 10',
   *     multiplier: '3'
   *   }
   */
  generateFutureTestData(count: number, startDate?: Date): FutureTestData[] {
    // Fallback to "today" if no startDate is given.
    const baseDate = startDate || new Date();
    const results: FutureTestData[] = [];

    // We'll define a day increment between future draws (e.g., every 2 days).
    // You can adjust this to daily, weekly, or any custom spacing.
    const DAY_INCREMENT = 2;

    // Define possible multipliers to pick from randomly.
    const possibleMultipliers = ['2', '3', '4', '5', '10'];

    for (let i = 0; i < count; i++) {
      // 1. Pick a date in the future, offset by i * DAY_INCREMENT
      const drawDate = new Date(baseDate.getTime());
      drawDate.setDate(drawDate.getDate() + i * DAY_INCREMENT);

      // 2. Build synergy-based 5 white balls
      const whiteBalls = this.generateFiveWhiteBalls();

      // 3. Build synergy-based or random powerball
      const powerBall = this.generateFuturePowerball();

      // 4. Pick a random multiplier
      const multiplier =
        possibleMultipliers[
          Math.floor(Math.random() * possibleMultipliers.length)
        ];

      // 5. Format into your typical historical object shape
      const futureDraw = {
        draw_date: drawDate.toISOString(),
        winning_numbers: `${whiteBalls.join(' ')} ${powerBall}`,
        multiplier,
      };

      results.push(futureDraw);
    }

    // You can now store or return this future data as `futureTestData`.
    return results;
  }

  // ------------------------------------------------------------
  // AI HELPER METHODS
  // ------------------------------------------------------------

  /**
   * Picks a powerball with synergy + random fallback.
   */
  private pickPowerballAi(): string {
    // Attempt synergy approach (using historical PBs)
    const possiblePBs = this.historicalData.map((row) => row[5]);

    if (possiblePBs && possiblePBs.length) {
      const freqMap = this.createFrequencyMap(possiblePBs);
      const weightedPBs = this.buildWeightedArrayFromMap(freqMap);

      // fallback if no weighting
      if (!weightedPBs.length) {
        return this.randomNumberInRange(1, 26);
      }

      return (
        weightedPBs[Math.floor(Math.random() * weightedPBs.length)] || '01'
      );
    }
    // fallback if no PB data
    return this.randomNumberInRange(1, 26);
  }

  /**
   * Generates a random fallback set of length 6 (1..69 for first five, 1..26 for PB).
   * This is used if synergy fails or there's no data in the set.
   */
  private generateFallbackSet(): string[] {
    const fallback = [];
    for (let i = 0; i < 5; i++) {
      fallback.push(this.randomNumberInRange(1, 69));
    }
    fallback.push(this.randomNumberInRange(1, 26));
    return fallback;
  }

  /**
   * Returns a random integer (as a string) between [min..max], zero-padded if needed.
   */
  private randomNumberInRange(min: number, max: number): string {
    const rand = Math.floor(Math.random() * (max - min + 1)) + min;

    return rand.toString().padStart(2, '0');
  }

  // ------------------------------------------------------------
  // BUILD + SORT HELPERS
  // ------------------------------------------------------------

  private buildWithTheFirst(
    firstPredictedNumber: string,
    initialPlay: string[]
  ): string[] {
    const firstNumber = firstPredictedNumber;

    const generateAndPickNextNumber = (
      predictedNumber: string,
      index: number
    ): string => {
      const synergyBasedNext = this.generateNextNumberArray(
        predictedNumber,
        index
      );
      const bestGuessSet = _.uniq(
        this.removeDuplicateStrings(synergyBasedNext)
      );

      // If synergy is empty, fallback
      if (!bestGuessSet || !bestGuessSet.length) {
        return this.randomNumberInRange(1, 69);
      }
      const picked = this.pickAdvancedProbabilityNumber(bestGuessSet);
      // fallback if none picked
      if (!picked) {
        return this.randomNumberInRange(1, 69);
      }
      return picked;
    };

    const secondNumber = generateAndPickNextNumber(firstNumber, 0);
    const thirdNumber = generateAndPickNextNumber(secondNumber, 1);
    const forthNumber = generateAndPickNextNumber(thirdNumber, 2);
    const fifthNumber = generateAndPickNextNumber(forthNumber, 3);

    const pbWeightedPredict = this.pickWeightedRandomFirstNumber(true);

    const finalPick = [
      firstNumber,
      secondNumber,
      thirdNumber,
      forthNumber,
      fifthNumber,
      pbWeightedPredict,
    ];

    // Range enforcement
    const enforcedRange = finalPick.map((val, idx) => {
      if (idx === 5) {
        const numeric = parseInt(val, 10);
        if (numeric < 1 || numeric > 26) {
          return this.fallbackPowerballValue(numeric);
        }
      } else {
        const numeric = parseInt(val, 10);
        if (numeric < 1 || numeric > 69) {
          return this.fallbackWhiteBallValue(numeric);
        }
      }
      return val;
    });

    return enforcedRange;
  }

  private sortGeneratedSet(generated: string[] | string[][]): string[] | string[][] {
    // Check if it's an array of arrays (string[][])
    if (Array.isArray(generated) && generated.length > 0 && Array.isArray(generated[0])) {
      // Array of arrays - map each sub-array
      return (generated as string[][]).map((g: string[]) => this.sortSingleSet(g));
    }
    // Check if it's a single array of 6 strings (string[])
    if (Array.isArray(generated) && generated.length === 6 && typeof generated[0] === 'string') {
      // Single set
      return this.sortSingleSet(generated as string[]);
    }
    // Fallback: if it's an array but doesn't match above patterns, try to handle it
    if (Array.isArray(generated)) {
      // Check if all items are arrays (nested arrays case)
      const allArrays = (generated as any[]).every(item => Array.isArray(item));
      if (allArrays) {
        return (generated as string[][]).map((item: string[]) => {
          if (item.length === 6) {
            return this.sortSingleSet(item);
          }
          return item;
        });
      }
      // If it's a single array but not 6 elements, return as-is
      return generated as string[];
    }
    // Fallback: return empty array if type is unexpected
    return [];
  }

  private sortSingleSet(setOfSix: string[]): string[] {
    if (!setOfSix || setOfSix.length !== 6) {
      return setOfSix;
    }
    const firstFive = setOfSix.slice(0, 5).map((val) => parseInt(val, 10));
    firstFive.sort((a, b) => a - b);
    const sortedStrings = firstFive.map((num) =>
      num.toString().padStart(2, '0')
    );
    return [...sortedStrings, setOfSix[5]];
  }

  // ------------------------------------------------------------
  // CLAMPING / FALLBACKS
  // ------------------------------------------------------------
  private fallbackPowerballValue(num: number): string {
    if (num < 1) return '01';
    if (num > 26) return '26';
    return num.toString().padStart(2, '0');
  }

  private fallbackWhiteBallValue(num: number): string {
    if (num < 1) return '01';
    if (num > 69) return '69';
    return num.toString().padStart(2, '0');
  }

  private pickRandomIndexInArray(array: string[]): string {
    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
  }

  // ------------------------------------------------------------
  // PROBABILITY PICKS
  // ------------------------------------------------------------

  private pickHighestProbabilityNumber(bestGuessSet: string[]): string {
    const frequencyMap = this.createFrequencyMap(bestGuessSet);

    this.historicalData.forEach((row) => {
      row.forEach((number) => {
        if (bestGuessSet.includes(number)) {
          frequencyMap[number] += 1;
        }
      });
    });

    let highestProbabilityNumber = bestGuessSet[0];
    let maxFrequency = frequencyMap[highestProbabilityNumber] || 0;

    for (const number of bestGuessSet) {
      if (frequencyMap[number] > maxFrequency) {
        highestProbabilityNumber = number;
        maxFrequency = frequencyMap[number];
      }
    }
    return highestProbabilityNumber;
  }

  private pickAdvancedProbabilityNumber(bestGuessSet: string[]): string {
    const RECENCY_EXP_BASE = this.configService.get('recencyExpBase');
    const frequencyMap = this.createFrequencyMap(bestGuessSet);

    this.historicalData.forEach((row, index) => {
      const reverseIndex = this.historicalData.length - 1 - index;
      row.forEach((number) => {
        if (bestGuessSet.includes(number)) {
          const exponent = Math.pow(RECENCY_EXP_BASE, reverseIndex);
          frequencyMap[number] += exponent;
        }
      });
    });

    const weightedArray = this.buildWeightedArrayFromMap(frequencyMap);

    return this.pickRandomFromWeightedArray(weightedArray, bestGuessSet);
  }

  // Exposes synergy + recency for the last 'recencyThreshold' draws
  private pickAdvancedProbabilityNumberWithRecency(
    bestGuessSet: string[],
    recencyThreshold: number
  ): string {
    const RECENCY_EXP_BASE = this.configService.get('recencyExpBase');
    const recentData = this.historicalData.slice(-recencyThreshold);
    const frequencyMap = this.createFrequencyMap(bestGuessSet);

    recentData.forEach((row, index) => {
      const reverseIndex = recentData.length - 1 - index;
      row.forEach((number) => {
        if (bestGuessSet.includes(number)) {
          const exponent = Math.pow(RECENCY_EXP_BASE, reverseIndex);
          frequencyMap[number] += exponent;
        }
      });
    });

    const weightedArray = this.buildWeightedArrayFromMap(frequencyMap);
    return this.pickRandomFromWeightedArray(weightedArray, bestGuessSet);
  }

  // ------------------------------------------------------------
  // DATA PARSING + FILTERS
  // ------------------------------------------------------------

  private async parseWinningNumbers(results: ParsedPowerballDraw[]): Promise<PowerballNumberSet[]> {
    try {
      const plays = results.map((set: ParsedPowerballDraw) => set.numbers);
      this.historicalData = _.clone(plays);

      // Initialize synergy
      for (let i = 0; i < 5; i++) {
        this.synergyMap[i] = {};
      }

      // Build synergy data
      for (const row of plays) {
        if (!row || row.length < 6) {
          console.warn('Invalid row data, skipping:', row);
          continue;
        }
        for (let i = 0; i < 4; i++) {
          const current = row[i];
          const next = row[i + 1];
          if (!current || !next) {
            continue;
          }
          if (!this.synergyMap[i][current]) {
            this.synergyMap[i][current] = {};
          }
          if (!this.synergyMap[i][current][next]) {
            this.synergyMap[i][current][next] = 0;
          }
          this.synergyMap[i][current][next]++;
        }
      }

      return plays.map((set: string[]): PowerballNumberSet => ({
        first: set[0] || '01',
        second: set[1] || '01',
        third: set[2] || '01',
        fourth: set[3] || '01',
        fifth: set[4] || '01',
        powerball: set[5] || '01',
      }));
    } catch (error) {
      console.error('Error parsing winning numbers:', error);
      throw new Error('Failed to parse winning numbers from historical data');
    }
  }

  private async filterParsedNumberSets(numberSets: PowerballNumberSet[] = []): Promise<FilteredNumberSet[]> {
    const firsts: number[] = [];
    const seconds: number[] = [];
    const thirds: number[] = [];
    const fourths: number[] = [];
    const fifths: number[] = [];
    const powerballs: number[] = [];

    const completeSets = [];

    numberSets.forEach((set: PowerballNumberSet) => {
      firsts.push(parseInt(set.first, 10));
      seconds.push(parseInt(set.second, 10));
      thirds.push(parseInt(set.third, 10));
      fourths.push(parseInt(set.fourth, 10));
      fifths.push(parseInt(set.fifth, 10));
      powerballs.push(parseInt(set.powerball, 10));

      completeSets.push({
        twoThree: [set.second, set.third],
        fourthFifth: [set.fourth, set.fifth],
      });
    });

    const parsedNumberSets = {
      first: firsts,
      second: seconds,
      third: thirds,
      fourth: fourths,
      fifth: fifths,
      powerball: powerballs,
    };

    const filteredNumbers: { key: string; numbers: number[] }[] = [];
    const dupCount = this.configService.get('whiteBallDupThreshold');

    for (const key in parsedNumberSets) {
      if (parsedNumberSets.hasOwnProperty(key)) {
        let result: number[] = [];
        switch (key) {
          case 'powerball':
            result = this.findDuplicates(parsedNumberSets[key], this.configService.get('powerballDupThreshold'));
            break;
          case 'first':
            result = this.findDuplicates(
              this.filterNumbersByRange(parsedNumberSets[key]),
              dupCount
            );
            if(this.configService.get('logsEnabled')) {
              console.group('First');
              console.log(result);
              console.groupEnd();
            }
            break;
          case 'second':
            result = this.findDuplicates(
              this.filterNumbersByRange(parsedNumberSets[key]),
              dupCount
            );
            if(this.configService.get('logsEnabled')) {
              console.group('Second');
              console.log(result);
              console.groupEnd();
            }
            break;
          case 'third':
            result = this.findDuplicates(
              this.filterNumbersByRange(parsedNumberSets[key]),
              dupCount
            );

            if(this.configService.get('logsEnabled')) {
              console.group('Third');
              console.log(result);
              console.groupEnd();
            }
            break;
          case 'fourth':
            result = this.findDuplicates(
              this.filterNumbersByRange(parsedNumberSets[key]),
              dupCount
            );
            if(this.configService.get('logsEnabled')) {
              console.group('Fourth');
              console.log(result);
              console.groupEnd();
            }
            break;
          case 'fifth':
            result = this.findDuplicates(
              this.filterNumbersByRange(parsedNumberSets[key]),
              dupCount
            );
            if(this.configService.get('logsEnabled')) {
              console.group('fifth');
              console.log(result);
              console.groupEnd();
            }
            break;
        }
        filteredNumbers.push({ key, numbers: result });
      }
    }

    return filteredNumbers;
  }

  // ------------------------------------------------------------
  // SYNERGY-BASED + SCANNING
  // ------------------------------------------------------------

  private generateNextNumberArray(
    selectedNumber: string,
    customIndex: number = 0
  ): string[] {
    return this.findNextNumbers(
      this.historicalData,
      selectedNumber,
      customIndex
    );
  }

  private removeDuplicateStrings(arr: string[]): string[] {
    return [...new Set(arr)];
  }

  private findNextNumbers(
    data: string[][],
    selectedNumber: string,
    customIndex: number = 0
  ): string[] {
    const synergyResults = this.getSynergyBasedNextNumbers(
      customIndex,
      selectedNumber
    );

    if (!synergyResults.length) {
      const nextNumbers: string[] = [];
      const strippedData = this.stripSixthElement(data);
      for (const subArray of strippedData) {
        if (customIndex < 0 || customIndex > 4) continue;
        if (subArray[customIndex] === selectedNumber) {
          if (customIndex < subArray.length - 1) {
            nextNumbers.push(subArray[customIndex + 1]);
          }
        }
      }
      return nextNumbers;
    }
    return synergyResults;
  }

  private getSynergyBasedNextNumbers(
    positionIndex: number,
    currentNum: string
  ) {
    if (!this.synergyMap[positionIndex][currentNum]) {
      return [];
    }
    const synergyObject = this.synergyMap[positionIndex][currentNum];
    const synergyWeightedArray: string[] = [];
    for (const nextNum in synergyObject) {
      const count = synergyObject[nextNum];
      for (let i = 0; i < count; i++) {
        synergyWeightedArray.push(nextNum);
      }
    }
    return synergyWeightedArray;
  }

  private stripSixthElement(data: string[][]): string[][] {
    return data.map((subArray) => subArray.slice(0, 5));
  }

  // ------------------------------------------------------------
  // RECENT DRAWS, RANGE, DUPLICATES
  // ------------------------------------------------------------

  async getRecentDrawings(count: number): Promise<RecentDrawing[]> {
    const recentDraws: PowerballDraw[] = [];
    const endIndex = Math.min(count, this.powerballData.length);
    for (let i = 0; i < endIndex; i++) {
      recentDraws.push(this.powerballData[i]);
    }
    return recentDraws.map((result): RecentDrawing => ({
      date: result.draw_date,
      numbers: result.winning_numbers.split(' '),
      multiplier: result.multiplier,
    }));
  }

  private filterNumbersByRange(
    set: number[],
    from: number = 1,
    to: number | null = null
  ): number[] {
    const fromSet = set.filter((num) => num >= from);
    if (to) {
      return fromSet.filter((num) => num <= to);
    }
    return fromSet;
  }

  private findDuplicates(array: number[], occurrence: number): number[] {
    const counts = array.reduce((acc, num) => {
      acc[num] = (acc[num] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return Object.keys(counts)
      .filter((key) => counts[Number(key)] >= occurrence)
      .map(Number);
  }

  // ------------------------------------------------------------
  // FIRST NUMBER PICKS
  // ------------------------------------------------------------

  private pickMostFrequentFirstNumber(powerball: boolean = false) {
    const index = powerball ? 5 : 0;
    const firstNumbers = this.historicalData.map((subArray) => subArray[index]);
    const frequencyMap = this.createFrequencyMap(firstNumbers);

    let mostFrequentNumber = firstNumbers[0] || '01';
    let maxCount = this.configService.get('minFrequencyThreshold');

    for (const number in frequencyMap) {
      if (frequencyMap[number] > maxCount) {
        maxCount = frequencyMap[number];
        mostFrequentNumber = number;
      }
    }

    return mostFrequentNumber;
  }

  private pickWeightedRandomFirstNumber(powerball: boolean = false) {
    const index = powerball ? 5 : 0;
    const firstNumbers = this.historicalData.map((subArray) => subArray[index]);
    const frequencyMap = this.createFrequencyMap(firstNumbers);
    const weightedArray = this.buildWeightedArrayFromMap(frequencyMap);

    if (!weightedArray.length) {
      return (
        firstNumbers[Math.floor(Math.random() * firstNumbers.length)] || '01'
      );
    }

    const randomIndex = Math.floor(Math.random() * weightedArray.length);

    return weightedArray[randomIndex];
  }

  // ------------------------------------------------------------
  // FREQUENCY MAP + WEIGHTED ARRAY
  // ------------------------------------------------------------

  private createFrequencyMap(arr: string[]): Record<string, number> {
    return arr.reduce((acc, cur) => {
      acc[cur] = (acc[cur] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private buildWeightedArrayFromMap(freqMap: Record<string, number>): string[] {
    const weightedArray: string[] = [];

    for (const [key, count] of Object.entries(freqMap)) {
      // Append the key 'count' times to the weightedArray
      for (let i = 0; i < count; i++) {
        weightedArray.push(key);
      }
    }

    return weightedArray;
  }

  private pickRandomFromWeightedArray(
    weightedArray: string[],
    fallbackSet: string[]
  ): string {
    if (!weightedArray.length) {
      return (
        fallbackSet[Math.floor(Math.random() * fallbackSet.length)] || '01'
      );
    }
    const randomIndex = Math.floor(Math.random() * weightedArray.length);
    return weightedArray[randomIndex];
  }

  /**
   * Internal helper that leverages synergy and advanced probability to generate
   * five unique white balls in the range 1..69, sorted ascending.
   * Adjust the recency bias or synergy logic as desired.
   *
   * @returns A string[] of length 5, e.g. ['03','12','27','48','59'],
   *          guaranteed to have no duplicates.
   */
  private generateFiveWhiteBalls(): string[] {
    const whiteBalls: string[] = [];

    // Start with a random "seed" from the historical data or random fallback
    let currentPick = this.randomNumberInRange(1, 69);

    for (let i = 0; i < 5; i++) {
      // Try synergy approach for the "next number"
      let synergyCandidates = this.findNextNumbers(
        this.historicalData,
        currentPick,
        i
      );

      // If synergy is empty, fallback to an empty array so we skip synergy entirely
      if (!synergyCandidates || synergyCandidates.length === 0) {
        synergyCandidates = [];
      }

      // Remove duplicates, just in case synergyCandidates repeated entries
      synergyCandidates = [...new Set(synergyCandidates)];

      // Use advanced recency weighting if synergyCandidates has data
      let nextPick: string | null = null;
      if (synergyCandidates.length > 0) {
        nextPick = this.pickAdvancedProbabilityNumber(synergyCandidates);
      }

      // If synergy picking fails or returns an empty string, fallback to random
      if (!nextPick) {
        nextPick = this.randomNumberInRange(1, 69);
      }

      // Ensure uniqueness: if we've already used nextPick, we re-roll
      let attempts = 0;
      const maxAttempts = this.configService.get('maxUniquenessAttempts');
      while (whiteBalls.includes(nextPick) && attempts < maxAttempts) {
        // Try synergy again or fallback to random
        const whiteBallRange = this.configService.get('whiteBallRange');
        nextPick = this.randomNumberInRange(whiteBallRange.min, whiteBallRange.max);
        attempts++;
      }

      // At this point, nextPick should be unique or we forcibly keep it
      whiteBalls.push(nextPick);
      currentPick = nextPick; // used for next synergy
    }

    // Sort ascending, preserve zero-padding
    const sortedNums = whiteBalls
      .map((val) => parseInt(val, 10))
      .sort((a, b) => a - b)
      .map((num) => num.toString().padStart(2, '0'));

    return sortedNums;
  }

  /**
   * Internal helper that picks a future Powerball (range 1..26).
   * Uses synergy or advanced weighting from your historical PB data (index = 5).
   */
  private generateFuturePowerball(): string {
    // Extract all past powerballs
    const historicalPBs = this.historicalData.map((row) => row[5]);
    if (!historicalPBs.length) {
      // fallback if none
      return this.randomNumberInRange(1, 26);
    }

    // Build synergy or advanced weighting approach
    const frequencyMap = this.createFrequencyMap(historicalPBs);
    const weightedPBs = this.buildWeightedArrayFromMap(frequencyMap);

    if (!weightedPBs.length) {
      // fallback
      return this.randomNumberInRange(1, 26);
    }

    // Weighted random pick
    const chosenPB =
      weightedPBs[Math.floor(Math.random() * weightedPBs.length)];
    const numericPB = parseInt(chosenPB, 10);

    // clamp if out of range
    if (numericPB < 1 || numericPB > 26) {
      return this.fallbackPowerballValue(numericPB);
    }
    return chosenPB.padStart(2, '0');
  }
}
