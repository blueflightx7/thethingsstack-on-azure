'use client';

/**
 * Microsoft Innovation Hub Theme
 * 
 * Based on the Microsoft Innovation Hub branding:
 * - Deep blues and teals for primary colors
 * - Modern gradients
 * - Professional yet innovative feel
 * - Both light and dark mode support
 */

// Microsoft Innovation Hub Color Palette
export const hubColors = {
  // Primary colors from Hub branding
  primary: '#0078D4',        // Microsoft Blue
  primaryDark: '#004578',    // Deep Blue
  primaryLight: '#50E6FF',   // Light Teal
  
  // Accent colors
  accent: '#00BCF2',         // Bright Teal
  accentDark: '#008272',     // Dark Teal
  accentLight: '#7FECFF',    // Soft Cyan
  
  // Innovation Hub specific
  hubGradientStart: '#0078D4',
  hubGradientMid: '#005A9E',
  hubGradientEnd: '#004578',
  
  // Status colors
  success: '#107C10',        // Green
  warning: '#FFB900',        // Amber
  critical: '#D13438',       // Red
  info: '#0078D4',           // Blue
  
  // Neutral palette
  neutralDark: '#201F1E',
  neutralPrimary: '#323130',
  neutralSecondary: '#605E5C',
  neutralTertiary: '#A19F9D',
  neutralLight: '#EDEBE9',
  neutralLighter: '#F3F2F1',
  neutralLightest: '#FAF9F8',
  white: '#FFFFFF',
  black: '#000000',
  
  // Backgrounds
  bgPrimary: '#FFFFFF',
  bgSecondary: '#F3F2F1',
  bgTertiary: '#EDEBE9',
  
  // Dark mode backgrounds
  bgPrimaryDark: '#201F1E',
  bgSecondaryDark: '#252423',
  bgTertiaryDark: '#323130',
};

// Light theme
export const lightTheme = {
  background: {
    primary: hubColors.bgPrimary,
    secondary: hubColors.bgSecondary,
    tertiary: hubColors.bgTertiary,
    accent: hubColors.primary,
    surface: hubColors.white,
  },
  foreground: {
    primary: hubColors.neutralPrimary,
    secondary: hubColors.neutralSecondary,
    tertiary: hubColors.neutralTertiary,
    onAccent: hubColors.white,
    accent: hubColors.primary,
  },
  border: {
    default: hubColors.neutralLight,
    subtle: hubColors.neutralLighter,
    strong: hubColors.neutralTertiary,
  },
  status: {
    success: hubColors.success,
    warning: hubColors.warning,
    critical: hubColors.critical,
    info: hubColors.info,
  },
  gradient: {
    primary: `linear-gradient(135deg, ${hubColors.hubGradientStart} 0%, ${hubColors.hubGradientEnd} 100%)`,
    accent: `linear-gradient(135deg, ${hubColors.accent} 0%, ${hubColors.accentDark} 100%)`,
    hero: `linear-gradient(135deg, ${hubColors.hubGradientStart} 0%, ${hubColors.hubGradientMid} 50%, ${hubColors.hubGradientEnd} 100%)`,
  },
};

// Dark theme
export const darkTheme = {
  background: {
    primary: hubColors.bgPrimaryDark,
    secondary: hubColors.bgSecondaryDark,
    tertiary: hubColors.bgTertiaryDark,
    accent: hubColors.primary,
    surface: hubColors.neutralDark,
  },
  foreground: {
    primary: hubColors.white,
    secondary: hubColors.neutralLight,
    tertiary: hubColors.neutralTertiary,
    onAccent: hubColors.white,
    accent: hubColors.primaryLight,
  },
  border: {
    default: hubColors.neutralSecondary,
    subtle: hubColors.neutralPrimary,
    strong: hubColors.neutralTertiary,
  },
  status: {
    success: '#6CCB5F',      // Lighter green for dark mode
    warning: '#FFD335',      // Lighter amber
    critical: '#F87C80',     // Lighter red
    info: '#50E6FF',         // Lighter blue
  },
  gradient: {
    primary: `linear-gradient(135deg, ${hubColors.primaryLight} 0%, ${hubColors.primary} 100%)`,
    accent: `linear-gradient(135deg, ${hubColors.accentLight} 0%, ${hubColors.accent} 100%)`,
    hero: `linear-gradient(135deg, ${hubColors.primary} 0%, ${hubColors.primaryDark} 100%)`,
  },
};

// Hive status colors (matching alert system)
export const hiveStatusColors = {
  healthy: {
    bg: '#E6F4EA',
    bgDark: '#1B3D26',
    text: '#107C10',
    textDark: '#6CCB5F',
    border: '#107C10',
  },
  warning: {
    bg: '#FFF4CE',
    bgDark: '#3D3320',
    text: '#7A6400',
    textDark: '#FFD335',
    border: '#FFB900',
  },
  critical: {
    bg: '#FDE7E9',
    bgDark: '#442726',
    text: '#A80000',
    textDark: '#F87C80',
    border: '#D13438',
  },
  unknown: {
    bg: '#F3F2F1',
    bgDark: '#323130',
    text: '#605E5C',
    textDark: '#A19F9D',
    border: '#A19F9D',
  },
};

// Temperature color scale (for heatmap)
export const temperatureScale = {
  cold: '#50E6FF',      // < 15°C - cyan
  cool: '#00BCF2',      // 15-25°C - teal
  optimal: '#107C10',   // 25-35°C - green (ideal brood temp)
  warm: '#FFB900',      // 35-38°C - amber
  hot: '#FF8C00',       // 38-40°C - orange
  critical: '#D13438',  // > 40°C - red
};

// Get temperature color based on Celsius value
export function getTemperatureColor(tempC: number | null | undefined): string {
  if (tempC == null) return '#A19F9D';
  if (tempC < 15) return temperatureScale.cold;
  if (tempC < 25) return temperatureScale.cool;
  if (tempC < 35) return temperatureScale.optimal;
  if (tempC < 38) return temperatureScale.warm;
  if (tempC < 40) return temperatureScale.hot;
  return temperatureScale.critical;
}

// Get hive status from temperature
export function getHiveStatusFromTemp(tempC: number | null | undefined): 'healthy' | 'warning' | 'critical' | 'unknown' {
  if (tempC == null) return 'unknown';
  if (tempC >= 33 && tempC <= 36) return 'healthy'; // Ideal brood temperature
  if (tempC >= 30 && tempC <= 38) return 'warning'; // Slightly off
  return 'critical'; // Too hot or too cold
}
