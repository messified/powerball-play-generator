# Powerball Play Generator

An Angular 17 application that generates Powerball lottery number predictions using multiple statistical and machine learning approaches. The application combines legacy statistical methods with modern ML/AI backend integration to produce diverse prediction strategies.

**Author**: Jesse Reese  
**Website**: [https://jessereese.com/](https://jessereese.com/)  
**LinkedIn**: [https://www.linkedin.com/in/jcreese/](https://www.linkedin.com/in/jcreese/)  
**Medium**: [https://medium.com/@Jesse_Reese](https://medium.com/@Jesse_Reese)  
**Github**: [https://github.com/messified](https://github.com/messified)

## Features

### Multiple Generation Strategies

The application employs 5+ different prediction algorithms running in parallel:

1. **Initial Random Play**: Random selection from filtered historical numbers
2. **Predictive Frequency-Based Play**: Uses most frequent first number with synergy-based progression
3. **Predictive Weighted Random Play**: Weighted random first number with synergy chains
4. **Highest Probability Play**: Advanced recency-weighted probability selection
5. **AI Predictive Set**: Synergy-based generation with intelligent fallbacks and random offsets
6. **ML Batch Generation**: Machine learning predictions via external Python backend API

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

### UI Components

- Interactive play generator interface
- Bar chart visualization showing monthly/yearly match statistics
- Historical match display with highlighting
- Lightbox integration for winnings chart reference

## Architecture

### Service Layer

```
PlayGeneratorComponent (Orchestrator)
├── PowerballService (976 lines)
│   ├── Synergy map building
│   ├── Recency weighting
│   ├── Multiple generation strategies
│   └── Probability calculations
├── PredictionService (382 lines)
│   ├── Higher-order Markov chains
│   ├── Advanced synergy mapping
│   └── Powerball prediction
├── AiPowerballService (123 lines)
│   ├── HTTP client for ML backend
│   ├── Batch generation
│   ├── Model training
│   └── Backtesting support
└── PickCheckerService (199 lines)
    ├── Match validation
    ├── Historical comparison
    └── Chart data management
```

### Key Files

- `src/app/services/powerball.service.ts` - Main legacy generator with multiple strategies
- `src/app/services/prediction.service.ts` - Higher-order Markov chain approach
- `src/app/services/ai-powerball.service.ts` - ML backend integration
- `src/app/services/pick-checker.service.ts` - Validation and matching logic
- `src/app/play-generator/play-generator.component.ts` - Main UI component
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

**Note**: The ML backend URL is currently hardcoded in `ai-powerball.service.ts`. For production, configure via environment variables.

## Usage

1. **Generate Plays**: Click the "Generate Numbers" button to create multiple prediction sets
2. **View Results**: The application displays:
   - Primary generated play
   - Historical matches (draws with 4+ matching numbers)
   - Total picks generated
   - Match statistics
3. **Analyze Patterns**: View bar charts showing monthly/yearly match distributions
4. **Review History**: Scroll through generated play history

## Configuration

### Current Configuration Parameters

The application uses several configurable parameters (currently scattered across services):

- **White Ball Range**: 1-69
- **Powerball Range**: 1-26
- **White Ball Duplicate Threshold**: 2-6 occurrences
- **Powerball Duplicate Threshold**: 5 occurrences
- **Recency Exponential Base**: 1.051 (PowerballService) / 1.055 (PredictionService)
- **Recency Threshold**: 50 most recent draws
- **Random Override Chance**: 10% (AI predictive set)

**Note**: These values are currently hardcoded in service files. A centralized configuration service is recommended for easier tuning.

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
│   ├── services/          # Core business logic
│   ├── play-generator/    # Main component
│   ├── bar-graph/         # Chart visualization
│   ├── data/              # Historical data files
│   └── app.component.*   # Root component
├── assets/                # Images and static files
└── styles.scss           # Global styles
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

- Hardcoded configuration values in multiple services
- ML backend URL hardcoded (needs environment configuration)
- Limited error handling and user feedback
- No comprehensive backtesting framework
- Type safety issues (use of `any` types)
- Performance optimizations needed (sequential processing, no memoization)

### Planned Enhancements

- [ ] Centralized configuration service
- [ ] Environment-based configuration for API URLs
- [ ] Comprehensive error handling with user feedback
- [ ] Walk-forward backtesting for all strategies
- [ ] Improved type safety throughout codebase
- [ ] Performance optimizations (parallel processing, memoization)
- [ ] Distribution analysis and validation
- [ ] User interface for adjusting parameters
- [ ] Comprehensive unit and integration tests

## Technical Details

### Dependencies

- **Angular**: 17.3.0
- **RxJS**: 7.8.0
- **Lodash**: 4.17.21 (utility functions)
- **Chart.js**: 4.4.8 (visualizations)
- **ng2-charts**: 6.0.1 (Angular Chart.js wrapper)
- **ag-grid**: 33.1.1 (data tables)
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
