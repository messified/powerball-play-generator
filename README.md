# Probability-Based Number Selector (PowerBall)

This Angular 17 app is designed to predict and select numbers based on historical data. It incorporates advanced probability-based logic and supports features like recency thresholds, weighted random selection, and ADA compliance.

Author: **Jesse Reese**  
Website: [https://jessereese.com/](https://jessereese.com/)  
LinkedIn: [https://www.linkedin.com/in/jcreese/](https://www.linkedin.com/in/jcreese/)  
Medium: [https://medium.com/@Jesse_Reese](https://medium.com/@Jesse_Reese)  
Github: [https://github.com/messified](https://github.com/messified)

## Features

- **Historical Data Analysis**: Uses historical data to predict numbers based on patterns.
- **Recency Threshold**: Focuses on recent data to improve prediction accuracy.
- **Weighted Random Selection**: Prioritizes numbers based on their frequency and recency.
- **ADA Compliance**: Ensures accessibility for all users.
- **Customizable Inputs**: Allows users to define recency thresholds and other parameters.

## Key Components

### `buildWithTheFirst`
Generates a complete number set starting with a user-selected first number. It predicts subsequent numbers based on historical data.

#### Example Logic:
1. Uses the first number as a starting point.
2. Predicts the next numbers in sequence using weighted probability logic.
3. Incorporates recency thresholds to prioritize recent trends.

### `pickAdvancedProbabilityNumberWithRecency`
An advanced function that selects the most probable number from a set based on:
- Frequency in historical data.
- Recency bias.
- Customizable recency threshold.

#### Parameters:
- `bestGuessSet` - Array of possible numbers.
- `recencyThreshold` - Number of recent rows to consider from historical data.

### `removeDuplicateStrings`
Removes duplicate strings from an array to ensure unique values.

#### Example:

## Installation

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
4. Run the app:
   ```bash
   ng serve
   ```

## Usage

1. Access the app in your browser at `http://localhost:4200`.
2. Input a starting number and customize parameters like recency thresholds.
3. View the predicted number set and its probabilities.

## Customization

- Modify the `historicalData` array in the service to include your data.
- Adjust the recency threshold in `pickAdvancedProbabilityNumberWithRecency` as needed.

## Future Enhancements

- Add a user-friendly interface for adjusting recency thresholds.
- Integrate machine learning models for advanced pattern recognition.
- Include time-based filtering for historical data.

## License

This project is licensed under the MIT License.
