/**
 * Alert Thresholds - Scientifically-backed values from BEEP documentation
 * Based on: https://beep.nl/index.php/beep-base
 * 
 * These thresholds are used for visual indicators and alerts throughout the dashboard.
 */

export type AlertLevel = 'optimal' | 'good' | 'warning' | 'critical';

export interface ThresholdRange {
  min: number;
  max: number;
}

// ============================================================================
// TEMPERATURE THRESHOLDS
// ============================================================================

export const temperatureThresholds = {
  /** Brood nest temperature - where eggs and larvae develop */
  brood: {
    optimal: { min: 34, max: 35 } as ThresholdRange,
    warning: { min: 32, max: 37 } as ThresholdRange,
    critical: { min: 30, max: 40 } as ThresholdRange,
    unit: '°C',
    description: 'Brood nest temperature for healthy larvae development',
  },
  /** Winter cluster temperature */
  winter: {
    optimal: { min: 27, max: 34 } as ThresholdRange,
    warning: { min: 25, max: 35 } as ThresholdRange,
    critical: { min: 20, max: 38 } as ThresholdRange,
    unit: '°C',
    description: 'Winter cluster core temperature',
  },
  /** Ambient hive temperature */
  ambient: {
    flightMinimum: 10, // Bees don't fly below this
    dangerLow: 5,      // Emergency cold
    unit: '°C',
  },
};

export function getTemperatureAlertLevel(temp: number | null | undefined, type: 'brood' | 'winter' = 'brood'): AlertLevel {
  if (temp == null) return 'good';
  
  const thresholds = temperatureThresholds[type];
  
  if (temp >= thresholds.optimal.min && temp <= thresholds.optimal.max) {
    return 'optimal';
  }
  if (temp >= thresholds.warning.min && temp <= thresholds.warning.max) {
    return 'good';
  }
  if (temp >= thresholds.critical.min && temp <= thresholds.critical.max) {
    return 'warning';
  }
  return 'critical';
}

// ============================================================================
// WEIGHT THRESHOLDS & PATTERNS
// ============================================================================

export const weightThresholds = {
  /** Swarm detection - sudden weight drop */
  swarm: {
    dropRateKgPerHour: 1.0,    // >1kg/hour drop indicates swarm
    typicalDropKg: { min: 1.5, max: 2.5 },
    description: 'Sudden drop of 1.5-2.5kg in under 30 minutes',
  },
  /** Robbery detection - linear decline during daylight */
  robbery: {
    declineKgPerDay: 0.5,      // >0.5kg/day decline
    sustainedHours: 4,          // For at least 4 hours during daylight
    description: 'Consistent weight decline during daylight hours (8AM-6PM)',
  },
  /** Good foraging - nectar flow */
  nectarFlow: {
    dailyGainKg: { min: 0.5, max: 5.0 },
    description: 'Daily weight gain of 0.5-5kg indicates active nectar flow',
  },
  /** Winter consumption */
  winterConsumption: {
    monthlyDeclineKg: { min: 0.5, max: 2.0 },
    description: 'Normal winter consumption: 0.5-2kg per month',
  },
  /** Starvation risk */
  starvation: {
    totalWeightKg: 10,         // Below 10kg total is risk
    description: 'Total hive weight below 10kg indicates starvation risk',
  },
};

export type WeightPattern = 
  | 'nectar-flow' 
  | 'swarm-detected' 
  | 'robbery-suspected' 
  | 'winter-consumption' 
  | 'starvation-risk' 
  | 'stable' 
  | 'unknown';

export function detectWeightPattern(
  currentKg: number | null | undefined,
  change24h: number | null | undefined,
  changeRateKgPerHour?: number | null
): WeightPattern {
  if (currentKg == null) return 'unknown';
  
  // Check starvation risk first
  if (currentKg < weightThresholds.starvation.totalWeightKg) {
    return 'starvation-risk';
  }
  
  // Check swarm (rapid drop)
  if (changeRateKgPerHour != null && changeRateKgPerHour < -weightThresholds.swarm.dropRateKgPerHour) {
    return 'swarm-detected';
  }
  
  // Check 24h patterns
  if (change24h != null) {
    if (change24h >= weightThresholds.nectarFlow.dailyGainKg.min) {
      return 'nectar-flow';
    }
    if (change24h <= -weightThresholds.robbery.declineKgPerDay) {
      return 'robbery-suspected';
    }
    if (change24h < 0 && change24h > -weightThresholds.robbery.declineKgPerDay) {
      return 'winter-consumption';
    }
  }
  
  return 'stable';
}

export function getWeightAlertLevel(pattern: WeightPattern): AlertLevel {
  switch (pattern) {
    case 'nectar-flow':
      return 'optimal';
    case 'stable':
    case 'winter-consumption':
      return 'good';
    case 'robbery-suspected':
      return 'warning';
    case 'swarm-detected':
    case 'starvation-risk':
      return 'critical';
    default:
      return 'good';
  }
}

// ============================================================================
// SOUND/FFT THRESHOLDS (BEEP Base: 71-583 Hz range)
// ============================================================================

export const fftThresholds = {
  /** Frequency ranges from BEEP Base */
  frequencyBins: {
    low: { min: 71, max: 173, label: 'Low (71-173 Hz)', meaning: 'Normal brood activity' },
    mid: { min: 173, max: 327, label: 'Mid (173-327 Hz)', meaning: 'Foraging activity, ventilation' },
    highMid: { min: 327, max: 480, label: 'High-Mid (327-480 Hz)', meaning: 'Increased activity' },
    high: { min: 480, max: 583, label: 'High (480-583 Hz)', meaning: 'Stress, aggression, swarming prep' },
  },
  /** Stress indicator - high frequency dominance */
  stressThreshold: {
    highFreqRatio: 0.6,        // >60% energy in 480-583Hz range
    description: 'More than 60% of sound energy in high frequency range indicates stress',
  },
  /** Silent/inactive colony */
  silentThreshold: {
    totalEnergy: 10,           // Near-zero activity
    description: 'Very low total sound energy may indicate colony loss',
  },
  /** Queen piping frequency */
  queenPiping: {
    freqRange: { min: 200, max: 500 },
    description: 'Distinct pattern at 200-500Hz indicates queen piping (pre-swarm)',
  },
};

export function getFFTAlertLevel(
  totalEnergy: number | null | undefined,
  highEnergy?: number | null
): AlertLevel {
  if (totalEnergy == null) return 'good';
  
  // Silent colony
  if (totalEnergy < fftThresholds.silentThreshold.totalEnergy) {
    return 'critical';
  }
  
  // High frequency stress
  if (highEnergy != null && totalEnergy > 0) {
    const highRatio = highEnergy / totalEnergy;
    if (highRatio > fftThresholds.stressThreshold.highFreqRatio) {
      return 'warning';
    }
  }
  
  return 'good';
}

// ============================================================================
// BATTERY THRESHOLDS
// ============================================================================

export const batteryThresholds = {
  good: 50,      // >50%
  warning: 20,   // 20-50%
  critical: 20,  // <20%
};

export function getBatteryAlertLevel(percent: number | null | undefined): AlertLevel {
  if (percent == null) return 'good';
  
  if (percent > batteryThresholds.good) return 'optimal';
  if (percent > batteryThresholds.warning) return 'warning';
  return 'critical';
}

// ============================================================================
// VISUAL HELPERS
// ============================================================================

export const alertColors = {
  optimal: '#107C10',   // Green - Microsoft success
  good: '#0078D4',      // Azure Blue
  warning: '#FFB900',   // Yellow - Microsoft warning
  critical: '#D13438',  // Red - Microsoft error
};

export function getAlertColor(level: AlertLevel): string {
  return alertColors[level];
}

export const patternLabels: Record<WeightPattern, string> = {
  'nectar-flow': '🍯 Nectar Flow',
  'swarm-detected': '🐝 Swarm Detected',
  'robbery-suspected': '⚠️ Robbery Suspected',
  'winter-consumption': '❄️ Winter Mode',
  'starvation-risk': '🚨 Starvation Risk',
  'stable': '✓ Stable',
  'unknown': '—',
};

export const patternDescriptions: Record<WeightPattern, string> = {
  'nectar-flow': 'Colony is actively collecting nectar - weight increasing',
  'swarm-detected': 'Sudden weight drop detected - colony may have swarmed',
  'robbery-suspected': 'Consistent weight loss during daylight hours',
  'winter-consumption': 'Normal winter honey consumption',
  'starvation-risk': 'Low total weight - consider feeding',
  'stable': 'Weight is stable',
  'unknown': 'Insufficient data',
};
