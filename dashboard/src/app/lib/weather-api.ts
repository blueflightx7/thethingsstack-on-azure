/**
 * National Weather Service (NWS) API Integration
 * 
 * Free, no API key required, US-only coverage
 * Documentation: https://www.weather.gov/documentation/services-web-api
 */

export interface NWSPoint {
  gridId: string;
  gridX: number;
  gridY: number;
  forecastUrl: string;
  forecastHourlyUrl: string;
  observationStationsUrl: string;
  relativeLocation: {
    city: string;
    state: string;
  };
}

export interface NWSObservation {
  timestamp: string;
  textDescription: string;
  temperature: {
    value: number | null;
    unitCode: string;
  };
  dewpoint: {
    value: number | null;
    unitCode: string;
  };
  relativeHumidity: {
    value: number | null;
    unitCode: string;
  };
  windSpeed: {
    value: number | null;
    unitCode: string;
  };
  windDirection: {
    value: number | null;
    unitCode: string;
  };
  barometricPressure: {
    value: number | null;
    unitCode: string;
  };
  visibility: {
    value: number | null;
    unitCode: string;
  };
  heatIndex?: {
    value: number | null;
    unitCode: string;
  };
  windChill?: {
    value: number | null;
    unitCode: string;
  };
}

export interface NWSForecastPeriod {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  temperature: number;
  temperatureUnit: 'F' | 'C';
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
  probabilityOfPrecipitation?: {
    value: number | null;
  };
  icon: string;
  isDaytime: boolean;
}

export interface NWSAlert {
  id: string;
  event: string;
  headline: string;
  description: string;
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
  urgency: 'Immediate' | 'Expected' | 'Future' | 'Past' | 'Unknown';
  certainty: 'Observed' | 'Likely' | 'Possible' | 'Unlikely' | 'Unknown';
  effective: string;
  expires: string;
  areas: string[];
}

export interface WeatherData {
  location: {
    city: string;
    state: string;
    latitude: number;
    longitude: number;
  };
  current: {
    timestamp: string;
    conditions: string;
    temperatureC: number | null;
    temperatureF: number | null;
    humidity: number | null;
    windSpeedKph: number | null;
    windDirection: string | null;
    pressure: number | null;
    visibility: number | null;
  };
  forecast: NWSForecastPeriod[];
  alerts: NWSAlert[];
  lastFetched: string;
}

// NWS API base URL
const NWS_BASE_URL = 'https://api.weather.gov';

// User agent required by NWS API
const USER_AGENT = 'BeehiveMonitorDashboard/1.0 (contact@example.com)';

/**
 * Convert Celsius to Fahrenheit
 */
function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9 / 5) + 32;
}

/**
 * Convert Fahrenheit to Celsius
 */
function fahrenheitToCelsius(fahrenheit: number): number {
  return (fahrenheit - 32) * 5 / 9;
}

/**
 * Convert meters per second to km/h
 */
function msToKph(ms: number): number {
  return ms * 3.6;
}

/**
 * Convert wind direction degrees to cardinal direction
 */
function degreesToCardinal(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

/**
 * Fetch with proper headers for NWS API
 */
async function nwsFetch<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/geo+json',
    },
  });

  if (!response.ok) {
    throw new Error(`NWS API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get the NWS grid point for a lat/lon coordinate
 */
export async function getNWSPoint(lat: number, lon: number): Promise<NWSPoint> {
  const url = `${NWS_BASE_URL}/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
  const data = await nwsFetch<{ properties: any }>(url);
  
  return {
    gridId: data.properties.gridId,
    gridX: data.properties.gridX,
    gridY: data.properties.gridY,
    forecastUrl: data.properties.forecast,
    forecastHourlyUrl: data.properties.forecastHourly,
    observationStationsUrl: data.properties.observationStations,
    relativeLocation: {
      city: data.properties.relativeLocation?.properties?.city || 'Unknown',
      state: data.properties.relativeLocation?.properties?.state || 'Unknown',
    },
  };
}

/**
 * Get observation stations near a point
 */
async function getObservationStations(stationsUrl: string): Promise<string[]> {
  const data = await nwsFetch<{ features: Array<{ properties: { stationIdentifier: string } }> }>(stationsUrl);
  return data.features.map(f => f.properties.stationIdentifier);
}

/**
 * Get latest observation from a station
 */
async function getLatestObservation(stationId: string): Promise<NWSObservation | null> {
  try {
    const url = `${NWS_BASE_URL}/stations/${stationId}/observations/latest`;
    const data = await nwsFetch<{ properties: any }>(url);
    
    return {
      timestamp: data.properties.timestamp,
      textDescription: data.properties.textDescription || 'Unknown',
      temperature: data.properties.temperature,
      dewpoint: data.properties.dewpoint,
      relativeHumidity: data.properties.relativeHumidity,
      windSpeed: data.properties.windSpeed,
      windDirection: data.properties.windDirection,
      barometricPressure: data.properties.barometricPressure,
      visibility: data.properties.visibility,
      heatIndex: data.properties.heatIndex,
      windChill: data.properties.windChill,
    };
  } catch {
    return null;
  }
}

/**
 * Get forecast for a point
 */
async function getForecast(forecastUrl: string): Promise<NWSForecastPeriod[]> {
  const data = await nwsFetch<{ properties: { periods: any[] } }>(forecastUrl);
  return data.properties.periods;
}

/**
 * Get active alerts for a point
 */
export async function getAlerts(lat: number, lon: number): Promise<NWSAlert[]> {
  const url = `${NWS_BASE_URL}/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;
  
  try {
    const data = await nwsFetch<{ features: Array<{ properties: any }> }>(url);
    
    return data.features.map(f => ({
      id: f.properties.id,
      event: f.properties.event,
      headline: f.properties.headline || '',
      description: f.properties.description || '',
      severity: f.properties.severity,
      urgency: f.properties.urgency,
      certainty: f.properties.certainty,
      effective: f.properties.effective,
      expires: f.properties.expires,
      areas: f.properties.areaDesc?.split('; ') || [],
    }));
  } catch {
    return [];
  }
}

/**
 * Main function to get complete weather data for a location
 */
export async function getWeatherData(lat: number, lon: number): Promise<WeatherData> {
  // Get grid point info
  const point = await getNWSPoint(lat, lon);
  
  // Get stations and find one with data
  const stations = await getObservationStations(point.observationStationsUrl);
  
  let observation: NWSObservation | null = null;
  for (const station of stations.slice(0, 3)) { // Try first 3 stations
    observation = await getLatestObservation(station);
    if (observation && observation.temperature.value !== null) {
      break;
    }
  }
  
  // Get forecast
  const forecast = await getForecast(point.forecastUrl);
  
  // Get alerts
  const alerts = await getAlerts(lat, lon);
  
  // Process observation data
  let temperatureC: number | null = null;
  let temperatureF: number | null = null;
  let humidity: number | null = null;
  let windSpeedKph: number | null = null;
  let windDirection: string | null = null;
  
  if (observation) {
    // Temperature (NWS returns in Celsius)
    if (observation.temperature.value !== null) {
      temperatureC = observation.temperature.value;
      temperatureF = celsiusToFahrenheit(temperatureC);
    }
    
    // Humidity
    if (observation.relativeHumidity.value !== null) {
      humidity = observation.relativeHumidity.value;
    }
    
    // Wind speed (NWS returns in m/s)
    if (observation.windSpeed.value !== null) {
      windSpeedKph = msToKph(observation.windSpeed.value);
    }
    
    // Wind direction
    if (observation.windDirection.value !== null) {
      windDirection = degreesToCardinal(observation.windDirection.value);
    }
  }
  
  return {
    location: {
      city: point.relativeLocation.city,
      state: point.relativeLocation.state,
      latitude: lat,
      longitude: lon,
    },
    current: {
      timestamp: observation?.timestamp || new Date().toISOString(),
      conditions: observation?.textDescription || 'Unknown',
      temperatureC,
      temperatureF,
      humidity,
      windSpeedKph,
      windDirection,
      pressure: observation?.barometricPressure.value ?? null,
      visibility: observation?.visibility.value ?? null,
    },
    forecast,
    alerts,
    lastFetched: new Date().toISOString(),
  };
}

/**
 * Check if weather alerts include severe events
 */
export function hasSevereWeather(alerts: NWSAlert[]): boolean {
  const severeEvents = ['Extreme', 'Severe'];
  return alerts.some(alert => severeEvents.includes(alert.severity));
}

/**
 * Get precipitation probability from forecast
 */
export function getPrecipitationProbability(forecast: NWSForecastPeriod[]): number | null {
  if (!forecast.length) return null;
  const current = forecast[0];
  return current.probabilityOfPrecipitation?.value ?? null;
}

/**
 * Compare hive temperature to external weather
 */
export interface TemperatureComparison {
  hiveInnerC: number;
  hiveOuterC: number;
  externalC: number;
  innerDelta: number;
  outerDelta: number;
  hiveInnerF: number;
  hiveOuterF: number;
  externalF: number;
  innerDeltaF: number;
  outerDeltaF: number;
  status: 'normal' | 'cold-stress' | 'heat-stress' | 'unknown';
}

export function compareTemperatures(
  hiveInnerC: number,
  hiveOuterC: number,
  externalC: number | null
): TemperatureComparison | null {
  if (externalC === null) return null;
  
  const innerDelta = hiveInnerC - externalC;
  const outerDelta = hiveOuterC - externalC;
  
  // Determine status based on temperature relationships
  let status: TemperatureComparison['status'] = 'normal';
  
  // If external is very cold and inner is struggling to maintain brood temp
  if (externalC < 10 && hiveInnerC < 30) {
    status = 'cold-stress';
  }
  // If external is hot and hive is overheating
  else if (externalC > 35 && hiveInnerC > 38) {
    status = 'heat-stress';
  }
  
  return {
    hiveInnerC,
    hiveOuterC,
    externalC,
    innerDelta,
    outerDelta,
    hiveInnerF: celsiusToFahrenheit(hiveInnerC),
    hiveOuterF: celsiusToFahrenheit(hiveOuterC),
    externalF: celsiusToFahrenheit(externalC),
    innerDeltaF: innerDelta * 9 / 5,
    outerDeltaF: outerDelta * 9 / 5,
    status,
  };
}

export default { getWeatherData, getAlerts, hasSevereWeather, compareTemperatures };
