# Powerball Play Generator

An Angular 17 application that generates Powerball lottery number predictions using multiple statistical and machine learning approaches. The application combines legacy statistical methods with modern ML/AI backend integration to produce diverse prediction strategies.

**Author**: Jesse Reese  
**Website**: [https://jessereese.com/](https://jessereese.com/)  
**LinkedIn**: [https://www.linkedin.com/in/jcreese/](https://www.linkedin.com/in/jcreese/)  
**Medium**: [https://medium.com/@Jesse_Reese](https://medium.com/@Jesse_Reese)  
**Github**: [https://github.com/messified](https://github.com/messified)

## Features

### Multiple Generation Strategies

The application employs 9 different prediction algorithms implemented using the Strategy Pattern. All strategies implement the `GenerationStrategy` interface and are managed through the `StrategyFactoryService`:

1. **Initial Random Strategy**: Random selection from filtered historical numbers with no statistical weighting
2. **Predictive Frequency Strategy**: Uses the most frequent first number from historical data with synergy-based progression for subsequent numbers
3. **Predictive Weighted Random Strategy**: Weighted random first number selection (based on frequency) with synergy-based transitions
4. **Highest Probability Strategy**: Advanced recency-weighted probability selection using exponential decay functions
5. **AI Predictive Strategy**: Synergy-based generation with intelligent fallbacks and random offsets (10% chance)
6. **Higher-Order Markov Strategy**: Uses higher-order Markov chains tracking transitions based on pairs of consecutive numbers
7. **Target Win Optimization Strategy**: Optimizes for specific win conditions (4 white balls or 3 white + powerball) using pattern analysis and co-occurrence groups
8. **Diff Pattern Strategy**: Generates plays by applying position-based diff patterns from previous picks analysis to the latest draw
9. **Ensemble Strategy**: Combines multiple strategies using weighted frequency distributions, consensus numbers, and diversity penalties

**ML Batch Generation**: Machine learning predictions via external Python backend API (separate from strategy pattern)

### Statistical Methods

- **Synergy Maps (Markov Chains)**: 
  - First-order transitions tracking number sequences (position i → i+1)
  - Higher-order transitions based on pairs of consecutive numbers
  - Position-specific transition frequency analysis

- **Recency Weighting**: 
  - Exponential decay functions (base 1.051-1.055) prioritizing recent draws
  - Configurable recency thresholds (default: 50 most recent draws)
  - Time-weighted frequency calculations

- **Frequency Analysis**: 
  - Historical occurrence counting
  - Weighted array generation for probability-based selection
  - Duplicate threshold filtering (white balls: 2-6 occurrences, powerball: 5 occurrences)

- **Data Leakage Prevention**: 
  - Uses `PowerballDataMinusLatest` to prevent training on future data
  - Walk-forward validation approach

### Data Processing & Validation

- Historical data parsing and filtering (from 2019 onwards)
- Match checking against historical draws
- Duplicate detection and removal
- Chart visualization of winning patterns (monthly/yearly breakdowns)
- Range enforcement (white balls: 1-69, powerball: 1-26)

### Walk-Forward Backtesting

- Comprehensive backtesting framework for validating strategies
- Leakage-safe walk-forward validation approach
- Configurable training window expansion (step size, holdout size)
- Performance metrics tracking (white hits, powerball hits, perfect matches, near misses)
- Strategy comparison with detailed analytics
- Step-by-step inspection of backtest results
- Time series and distribution visualizations

### Diff Analysis

- Compares generated picks against the latest draw
- Calculates position-based differences for each pick
- Identifies recurring diff patterns across picks
- Pattern frequency and percentage analysis
- Supports diff pattern-based generation strategy

### UI Components

- Interactive play generator interface
- Bar chart visualization showing monthly/yearly match statistics
- Historical match display with highlighting
- Lightbox integration for winnings chart reference
- Backtest results dashboard with multiple analysis tabs
- Diff analysis visualization and pattern identification

## Routes & Pages

The application includes multiple routes for different functionalities:

- **`/generator`** (default) - Main play generator component for generating Powerball number predictions
- **`/backtest`** - Backtesting results and analysis dashboard with strategy performance metrics
- **`/backtest/inspect`** - Step-by-step backtest inspection for detailed analysis of individual test steps
- **`/diff-analysis`** - Diff pattern analysis page for comparing picks against latest draws

## Architecture

### Service Layer

```
PlayGeneratorComponent (Orchestrator)
├── PowerballService
│   ├── Synergy map building
│   ├── Recency weighting
│   ├── Legacy generation methods
│   └── Probability calculations
├── PredictionService
│   ├── Higher-order Markov chains
│   ├── Advanced synergy mapping
│   └── Powerball prediction
├── PowerballConfigService
│   ├── Centralized configuration management
│   ├── Environment-based API URL configuration
│   └── Service-specific config overrides
├── StrategyFactoryService
│   ├── Strategy pattern implementation
│   ├── Strategy registration and retrieval
│   └── Generation context creation
├── BacktestService
│   ├── Walk-forward backtesting
│   ├── Strategy performance evaluation
│   └── Leakage-safe validation
├── DiffAnalysisService
│   ├── Pick-to-draw comparison
│   ├── Diff pattern identification
│   └── Pattern frequency analysis
├── AiPowerballService
│   ├── HTTP client for ML backend
│   ├── Batch generation
│   ├── Model training
│   └── Backtesting support
└── PickCheckerService
    ├── Match validation
    ├── Historical comparison
    └── Chart data management
```

### Key Files

**Services:**
- `src/app/services/powerball.service.ts` - Main legacy generator with multiple strategies
- `src/app/services/prediction.service.ts` - Higher-order Markov chain approach
- `src/app/services/powerball-config.service.ts` - Centralized configuration management
- `src/app/services/backtest.service.ts` - Walk-forward backtesting framework
- `src/app/services/diff-analysis.service.ts` - Diff pattern analysis
- `src/app/services/ai-powerball.service.ts` - ML backend integration
- `src/app/services/pick-checker.service.ts` - Validation and matching logic
- `src/app/services/strategies/` - Strategy pattern implementations (9 strategies)
- `src/app/services/strategies/strategy-factory.service.ts` - Strategy factory and management

**Components:**
- `src/app/play-generator/play-generator.component.ts` - Main play generator UI
- `src/app/backtest-results/backtest-results.component.ts` - Backtesting results dashboard
- `src/app/diff-analysis-page/diff-analysis-page.component.ts` - Diff analysis page

**Data:**
- `src/app/data/historical-data.ts` - Historical Powerball draw data

## Installation

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- Angular CLI 17+
- Python 3.8+ (for ML backend, optional)

### Frontend Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/messified/play-generator.git
   ```

2. Navigate to the project directory:
   ```bash
   cd play-generator
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Run the development server:
   ```bash
   ng serve
   ```

5. Access the application at `http://localhost:4200`

### ML Backend Setup (Optional)

The application can integrate with a Python ML backend for advanced predictions. To use this feature:

1. Ensure the ML backend service is running on `http://localhost:8000`
2. The backend should expose the following endpoints:
   - `POST /predict` - Single prediction
   - `POST /generate` - Batch generation
   - `POST /train` - Model training
   - `POST /backtest` - Walk-forward backtesting

3. If the backend is unavailable, the application will fall back to local statistical methods

**Note**: The ML backend URL is configurable via `PowerballConfigService` and environment variables. The default URL is `http://localhost:8000`, but can be overridden by setting `environment.apiUrl` or through the configuration service.

## Usage

### Play Generator (`/generator`)

1. **Generate Plays**: Click the "Generate Numbers" button to create multiple prediction sets using various strategies
2. **View Results**: The application displays:
   - Primary generated play
   - Historical matches (draws with 4+ matching numbers)
   - Total picks generated
   - Match statistics
3. **Analyze Patterns**: View bar charts showing monthly/yearly match distributions
4. **Review History**: Scroll through generated play history
5. **Strategy Selection**: Configure which strategies to use for generation (if available in UI)
6. **Target Win Optimization**: Enable/configure target win optimization for specific win conditions

### Backtesting (`/backtest`)

1. **Run Backtest**: The backtest page automatically runs a walk-forward backtest with default configuration
2. **View Results**: Analyze strategy performance through multiple tabs:
   - **Overview**: Summary metrics and quick insights
   - **Performance**: Time series charts and distribution analysis
   - **Consistency**: Variance and standard deviation metrics
   - **Outcome**: Perfect matches, near misses, and match group distributions
   - **Efficiency**: Hits per ticket and ticket efficiency metrics
3. **Filter by Date Range**: Use date range filters to analyze specific time periods
4. **Inspect Steps**: Navigate to step inspection for detailed analysis of individual backtest steps

### Diff Analysis (`/diff-analysis`)

1. **Generate and Analyze**: Click to generate picks and analyze them against the latest draw
2. **View Diff Patterns**: See position-based differences for each generated pick
3. **Pattern Identification**: Review recurring diff patterns with frequency and percentage data
4. **Use Patterns**: Diff patterns can be used by the Diff Pattern Strategy for generation

## Configuration

### Centralized Configuration Service

All configuration parameters are managed through `PowerballConfigService` (located in `src/app/services/powerball-config.service.ts`). This provides a single source of truth for all configuration values.

### Configuration Parameters

**Number Ranges:**
- **White Ball Range**: 1-69
- **Powerball Range**: 1-26

**Duplicate Thresholds:**
- **White Ball Duplicate Threshold**: 4 (default, can vary by service)
- **Powerball Duplicate Threshold**: 4 (default, can vary by service)

**Recency Weighting:**
- **Recency Exponential Base**: 1.051 (default, PredictionService uses 1.055)
- **Recency Threshold**: 50 most recent draws

**Generation Parameters:**
- **Random Offset Chance**: 10% (AI predictive strategy)
- **Max Uniqueness Attempts**: 20
- **Min Frequency Threshold**: 5

**Data Filtering:**
- **From Date**: 2019-01-04 (historical data start date)

**ML/AI Generation:**
- **Number of Tickets**: 60
- **Diversity Min Hamming**: 8
- **Recency Decay**: 0.98
- **Alpha Smooth**: 0.5
- **Temperature**: 0.9

**Target Win Optimization:**
- **Enabled**: false (default)
- **Target Type**: 'both' | 'fourWhite' | 'threeWhitePowerball'
- **Pattern Analysis Window**: 200 draws
- **Co-occurrence Threshold**: 2

**API Configuration:**
- **API URL**: Configurable via `environment.apiUrl` (defaults to `http://localhost:8000`)

**Component Configuration:**
- **Generation Counter**: 20 picks per generation
- **Past Drawing Count**: 200 draws for analysis

Configuration can be accessed programmatically via `PowerballConfigService.get()` and updated via `PowerballConfigService.set()` or `PowerballConfigService.updateConfig()`.

## Statistical Approach

### Synergy Maps

Synergy maps track how often numbers appear together in sequence:

- **First-Order**: Tracks immediate transitions (e.g., if 12 appears in position 0, what appears in position 1)
- **Higher-Order**: Tracks transitions based on pairs (e.g., if [12, 25] appears, what follows)

### Recency Weighting

Recent draws are weighted more heavily using exponential decay:

```
weight = base^(reverse_index)
```

Where `reverse_index` is the position from the most recent draw (0 = most recent).

### Generation Flow

1. Load and filter historical data (from configured start date)
2. Parse winning numbers into structured format
3. Build synergy maps from historical patterns
4. Filter numbers by duplicate thresholds
5. Generate multiple plays using different strategies
6. Sort white balls (first 5 numbers) in ascending order
7. Validate ranges and format output

## Development

### Project Structure

```
src/
├── app/
│   ├── services/                    # Core business logic
│   │   ├── strategies/              # Strategy pattern implementations
│   │   │   ├── generation-strategy.interface.ts
│   │   │   ├── strategy-factory.service.ts
│   │   │   ├── initial-random-strategy.ts
│   │   │   ├── predictive-frequency-strategy.ts
│   │   │   ├── predictive-weighted-random-strategy.ts
│   │   │   ├── highest-probability-strategy.ts
│   │   │   ├── ai-predictive-strategy.ts
│   │   │   ├── higher-order-markov-strategy.ts
│   │   │   ├── target-win-strategy.ts
│   │   │   ├── diff-pattern-strategy.ts
│   │   │   └── ensemble-strategy.ts
│   │   ├── powerball.service.ts
│   │   ├── prediction.service.ts
│   │   ├── powerball-config.service.ts
│   │   ├── backtest.service.ts
│   │   ├── diff-analysis.service.ts
│   │   ├── ai-powerball.service.ts
│   │   └── pick-checker.service.ts
│   ├── play-generator/              # Main play generator component
│   ├── backtest-results/            # Backtesting UI components
│   │   └── step-inspection/         # Step-by-step inspection
│   ├── diff-analysis/               # Diff analysis component
│   ├── diff-analysis-page/          # Diff analysis page
│   ├── bar-graph/                   # Chart visualization
│   ├── line-graph/                  # Line chart visualization
│   ├── ag-grid-data-table/          # Data table component
│   ├── lottery-settings/            # Settings component
│   ├── models/                      # TypeScript interfaces
│   ├── data/                        # Historical data files
│   └── app.component.*              # Root component
├── environments/                    # Environment configuration
├── assets/                          # Images and static files
└── styles.scss                      # Global styles
```

### Running Tests

```bash
ng test
```

**Note**: Test files exist but implementations may be incomplete.

### Building for Production

```bash
ng build --configuration production
```

## Known Limitations & Future Improvements

### Current Limitations

- Limited error handling and user feedback in some areas
- Type safety issues (use of `any` types in some legacy code)
- Performance optimizations needed (sequential processing, limited memoization)
- Test coverage may be incomplete (test files exist but implementations may need completion)

### Planned Enhancements

- [ ] Comprehensive error handling with user feedback throughout the application
- [ ] Improved type safety throughout codebase (eliminate `any` types)
- [ ] Performance optimizations (parallel processing, memoization, caching)
- [ ] Distribution analysis and validation tools
- [ ] User interface for adjusting configuration parameters
- [ ] Comprehensive unit and integration tests
- [ ] Export/import functionality for backtest results
- [ ] Real-time strategy performance monitoring

## Technical Details

### Dependencies

**Core Framework:**
- **Angular**: 17.3.0
- **RxJS**: 7.8.0
- **TypeScript**: 5.4.2

**UI Libraries:**
- **Angular Material**: 17.3.10 (UI components)
- **Angular CDK**: 17.3.10 (component development kit)
- **Chart.js**: 4.4.8 (visualizations)
- **ng2-charts**: 6.0.1 (Angular Chart.js wrapper)
- **ag-grid-angular**: 33.1.1 (data tables)
- **ag-grid-community**: 33.1.1 (data grid core)

**Utilities:**
- **Lodash**: 4.17.21 (utility functions)
- **Moment**: 2.30.1 (date/time manipulation)

**Notifications & UI Enhancements:**
- **ngx-toastr**: 19.0.0 (notifications)
- **ngx-lightbox**: 3.0.0 (image lightbox)

### Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6+ support required

## License

This project is licensed under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Disclaimer

This application is for educational and entertainment purposes only. Lottery numbers are drawn randomly, and no prediction system can guarantee winning numbers. The statistical methods used are experimental and should not be considered as financial or gambling advice.
