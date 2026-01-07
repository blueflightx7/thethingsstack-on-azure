'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  TemperatureUnit,
  WeightUnit,
  loadTemperatureUnit,
  saveTemperatureUnit,
  loadWeightUnit,
  saveWeightUnit,
  formatTemperature,
  formatWeight,
  getTemperatureValue,
  getWeightValue,
  getTemperatureSymbol,
  getWeightSymbol,
  celsiusToFahrenheit,
  kgToLbs,
} from '../lib/units';

interface UnitPreferencesContextType {
  // Current units
  temperatureUnit: TemperatureUnit;
  weightUnit: WeightUnit;
  
  // Setters
  setTemperatureUnit: (unit: TemperatureUnit) => void;
  setWeightUnit: (unit: WeightUnit) => void;
  
  // Toggle helpers
  toggleTemperatureUnit: () => void;
  toggleWeightUnit: () => void;
  
  // Formatting helpers (with current unit)
  formatTemp: (celsius: number | null | undefined, decimals?: number) => string;
  formatWt: (kg: number | null | undefined, decimals?: number) => string;
  
  // Value conversion helpers
  getTempValue: (celsius: number | null | undefined) => number | null;
  getWtValue: (kg: number | null | undefined) => number | null;
  
  // Symbol helpers
  tempSymbol: string;
  wtSymbol: string;
}

const UnitPreferencesContext = createContext<UnitPreferencesContextType | null>(null);

interface UnitPreferencesProviderProps {
  children: ReactNode;
}

export function UnitPreferencesProvider({ children }: UnitPreferencesProviderProps) {
  const [temperatureUnit, setTempUnit] = useState<TemperatureUnit>('fahrenheit');
  const [weightUnit, setWtUnit] = useState<WeightUnit>('lbs');
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setTempUnit(loadTemperatureUnit());
    setWtUnit(loadWeightUnit());
    setIsHydrated(true);
  }, []);

  const setTemperatureUnit = useCallback((unit: TemperatureUnit) => {
    setTempUnit(unit);
    saveTemperatureUnit(unit);
  }, []);

  const setWeightUnit = useCallback((unit: WeightUnit) => {
    setWtUnit(unit);
    saveWeightUnit(unit);
  }, []);

  const toggleTemperatureUnit = useCallback(() => {
    const newUnit = temperatureUnit === 'fahrenheit' ? 'celsius' : 'fahrenheit';
    setTemperatureUnit(newUnit);
  }, [temperatureUnit, setTemperatureUnit]);

  const toggleWeightUnit = useCallback(() => {
    const newUnit = weightUnit === 'lbs' ? 'kg' : 'lbs';
    setWeightUnit(newUnit);
  }, [weightUnit, setWeightUnit]);

  const formatTemp = useCallback(
    (celsius: number | null | undefined, decimals: number = 1) =>
      formatTemperature(celsius, temperatureUnit, decimals),
    [temperatureUnit]
  );

  const formatWt = useCallback(
    (kg: number | null | undefined, decimals: number = 1) =>
      formatWeight(kg, weightUnit, decimals),
    [weightUnit]
  );

  const getTempValue = useCallback(
    (celsius: number | null | undefined) =>
      getTemperatureValue(celsius, temperatureUnit),
    [temperatureUnit]
  );

  const getWtValue = useCallback(
    (kg: number | null | undefined) =>
      getWeightValue(kg, weightUnit),
    [weightUnit]
  );

  const value: UnitPreferencesContextType = {
    temperatureUnit,
    weightUnit,
    setTemperatureUnit,
    setWeightUnit,
    toggleTemperatureUnit,
    toggleWeightUnit,
    formatTemp,
    formatWt,
    getTempValue,
    getWtValue,
    tempSymbol: getTemperatureSymbol(temperatureUnit),
    wtSymbol: getWeightSymbol(weightUnit),
  };

  // Avoid hydration mismatch by not rendering until client is ready
  if (!isHydrated) {
    return (
      <UnitPreferencesContext.Provider value={value}>
        {children}
      </UnitPreferencesContext.Provider>
    );
  }

  return (
    <UnitPreferencesContext.Provider value={value}>
      {children}
    </UnitPreferencesContext.Provider>
  );
}

export function useUnitPreferences(): UnitPreferencesContextType {
  const context = useContext(UnitPreferencesContext);
  if (!context) {
    throw new Error('useUnitPreferences must be used within a UnitPreferencesProvider');
  }
  return context;
}

// Optional hook that doesn't throw if provider is missing
export function useUnitPreferencesOptional(): UnitPreferencesContextType | null {
  return useContext(UnitPreferencesContext);
}
