# Data Interpretation & Colony Health

This system implements the data interpretation logic defined by [BEEP.nl](https://beep.nl/measurement-system-2/data-interpretation), adapting it for the The Things Stack on Azure architecture.

## 1. Data Pipeline & Processing

The interpretation logic is applied across the stack:

1.  **Ingestion (`ProcessToSQL`)**:
    *   **Sound**: Raw FFT bins (10 bins, 71Hz - 583Hz) are aggregated into three bands:
        *   **Low (71-224 Hz)**: Flight, fanning, colony "breathing".
        *   **Mid (224-378 Hz)**: General activity.
        *   **High (378-583 Hz)**: Stress, "tooting/quacking" (queens), hissing.
    *   **Storage**: These aggregated values are stored in the `Measurements` SQL table for efficient querying.

2.  **API (`DashboardApi`)**:
    *   **Health Analysis**: The API compares current values against biological thresholds (e.g., brood temperature) and historical trends (24h weight delta) to return a `health` object.

3.  **Visualization (`Dashboard`)**:
    *   **Health Card**: Displays the interpreted state (e.g., "Brood Rearing", "Nectar Flow").
    *   **Charts**: Visualizes the raw data with context-aware legends.

## 2. Interpretation Logic

### Temperature: Brood Rearing
*   **Source**: `Temperature_Inner`
*   **Logic**: Honeybees strictly regulate the brood nest temperature between **34°C and 36°C** when rearing brood.
*   **States**:
    *   **Brood Rearing**: 34°C ≤ T ≤ 36°C
    *   **No Brood / Inactive**: T < 33°C (in active season) or fluctuating.
    *   **Overheating**: T > 37°C

### Weight: Flow & Events
*   **Source**: `Weight_KG`
*   **Logic**: Comparison of current weight vs. 24 hours ago.
*   **Patterns**:
    *   **Nectar Flow**: Significant daily gain (> 0.5 kg/day).
    *   **Consumption**: Slow, steady decline (winter/dearth).
    *   **Robbery**: Sharp, linear decline during daylight hours.
    *   **Swarm**: Sudden drop (~2kg) in < 1 hour. (Visualized in charts).

### Sound: Colony Mood
*   **Source**: `SoundEnergyLow`, `SoundEnergyHigh`
*   **Logic**: Ratio of High frequency energy to Total energy.
*   **Patterns**:
    *   **Calm / Fanning**: Dominant **Low** band.
    *   **Stress / Queen**: Spikes in **High** band.

## 3. SQL Schema Mapping

| BEEP Concept | SQL Column | Derivation |
| :--- | :--- | :--- |
| **Weight** | `Weight_KG` | Raw sensor value |
| **Brood Temp** | `Temperature_Inner` | Raw sensor value |
| **Sound (Low)** | `SoundEnergyLow` | Sum of bins 1-3 (71-224 Hz) |
| **Sound (Mid)** | `SoundEnergyMid` | Sum of bins 4-6 (224-378 Hz) |
| **Sound (High)** | `SoundEnergyHigh` | Sum of bins 7-10 (378-583 Hz) |
