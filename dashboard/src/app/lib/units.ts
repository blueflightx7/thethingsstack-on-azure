'use client';

/**
 * Unit conversion utilities for the beehive dashboard.
 * 
 * Temperature: Data stored in Celsius, display in F or C
 * Weight: Data stored in centigrams (cg), display in lbs or kg
 */

// ============ Temperature ============

export type TemperatureUnit = 'fahrenheit' | 'celsius';

export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9/5) + 32;
}

export function fahrenheitToCelsius(fahrenheit: number): number {
  return (fahrenheit - 32) * 5/9;
}

export function formatTemperature(
  celsius: number | null | undefined,
  unit: TemperatureUnit,
  decimals: number = 1
): string {
  if (celsius == null || isNaN(celsius)) return '—';
  
  const value = unit === 'fahrenheit' ? celsiusToFahrenheit(celsius) : celsius;
  return `${value.toFixed(decimals)}°${unit === 'fahrenheit' ? 'F' : 'C'}`;
}

export function getTemperatureValue(
  celsius: number | null | undefined,
  unit: TemperatureUnit
): number | null {
  if (celsius == null || isNaN(celsius)) return null;
  return unit === 'fahrenheit' ? celsiusToFahrenheit(celsius) : celsius;
}

export function getTemperatureSymbol(unit: TemperatureUnit): string {
  return unit === 'fahrenheit' ? '°F' : '°C';
}

// ============ Weight ============

export type WeightUnit = 'lbs' | 'kg';

// Conversion constants
const CENTIGRAMS_PER_KG = 100000; // 100,000 cg = 1 kg
const LBS_PER_KG = 2.20462;

export function centigramsToKg(centigrams: number): number {
  return centigrams / CENTIGRAMS_PER_KG;
}

export function kgToLbs(kg: number): number {
  return kg * LBS_PER_KG;
}

export function lbsToKg(lbs: number): number {
  return lbs / LBS_PER_KG;
}

export function centigramsToLbs(centigrams: number): number {
  return kgToLbs(centigramsToKg(centigrams));
}

/**
 * Format weight for display.
 * Input is assumed to be in kg (as that's what comes from the API after initial conversion).
 * If the API returns centigrams, convert first with centigramsToKg().
 */
export function formatWeight(
  kg: number | null | undefined,
  unit: WeightUnit,
  decimals: number = 1
): string {
  if (kg == null || isNaN(kg)) return '—';
  
  const value = unit === 'lbs' ? kgToLbs(kg) : kg;
  return `${value.toFixed(decimals)} ${unit}`;
}

export function getWeightValue(
  kg: number | null | undefined,
  unit: WeightUnit
): number | null {
  if (kg == null || isNaN(kg)) return null;
  return unit === 'lbs' ? kgToLbs(kg) : kg;
}

export function getWeightSymbol(unit: WeightUnit): string {
  return unit;
}

// ============ Preference Storage ============

const TEMP_UNIT_KEY = 'beehive-temp-unit';
const WEIGHT_UNIT_KEY = 'beehive-weight-unit';

export function loadTemperatureUnit(): TemperatureUnit {
  if (typeof window === 'undefined') return 'fahrenheit';
  const stored = localStorage.getItem(TEMP_UNIT_KEY);
  return (stored === 'celsius' || stored === 'fahrenheit') ? stored : 'fahrenheit';
}

export function saveTemperatureUnit(unit: TemperatureUnit): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TEMP_UNIT_KEY, unit);
}

export function loadWeightUnit(): WeightUnit {
  if (typeof window === 'undefined') return 'lbs';
  const stored = localStorage.getItem(WEIGHT_UNIT_KEY);
  return (stored === 'lbs' || stored === 'kg') ? stored : 'lbs';
}

export function saveWeightUnit(unit: WeightUnit): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(WEIGHT_UNIT_KEY, unit);
}
