'use client';

import { useMemo } from 'react';
import { makeStyles, shorthands, mergeClasses } from '@griffel/react';
import { Text } from '@fluentui/react-text';
import { Badge } from '@fluentui/react-badge';
import { Tooltip } from '@fluentui/react-tooltip';
import { tokens } from '@fluentui/react-theme';
import { 
  WeatherRainShowersDay20Regular,
  WeatherSunny20Regular,
  WeatherCloudy20Regular,
  WeatherRain20Regular,
  WeatherSnow20Regular,
  WeatherThunderstorm20Regular,
  WeatherFog20Regular,
  Warning20Regular,
  ArrowUp16Regular,
  ArrowDown16Regular,
  Drop20Regular,
  ArrowSyncCircle20Regular, // Using for wind
} from '@fluentui/react-icons';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.padding('24px'),
    backgroundColor: tokens.colorNeutralBackground1,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
    minWidth: '300px',
    position: 'relative',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
  },
  iconContainer: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    backgroundColor: 'rgba(0, 120, 212, 0.1)',
    color: '#0078D4',
  },
  iconSevere: {
    backgroundColor: 'rgba(209, 52, 56, 0.1)',
    color: '#D13438',
  },
  label: {
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    letterSpacing: '0.5px',
  },
  locationText: {
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
  },
  mainContent: {
    display: 'flex',
    alignItems: 'flex-start',
    ...shorthands.gap('20px'),
    marginBottom: '16px',
  },
  weatherIcon: {
    fontSize: '64px',
    lineHeight: 1,
  },
  tempSection: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('4px'),
  },
  temperature: {
    fontSize: '48px',
    fontWeight: tokens.fontWeightBold,
    lineHeight: 1,
    color: tokens.colorNeutralForeground1,
  },
  conditions: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase300,
  },
  comparisonGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    ...shorthands.gap('12px'),
    marginTop: '8px',
    ...shorthands.padding('12px'),
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  comparisonItem: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('2px'),
  },
  comparisonLabel: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  comparisonValue: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
  },
  deltaPositive: {
    color: '#D13438',
    fontSize: tokens.fontSizeBase100,
    display: 'flex',
    alignItems: 'center',
  },
  deltaNegative: {
    color: '#0078D4',
    fontSize: tokens.fontSizeBase100,
    display: 'flex',
    alignItems: 'center',
  },
  detailsRow: {
    display: 'flex',
    ...shorthands.gap('16px'),
    marginTop: '12px',
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('6px'),
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  detailIcon: {
    fontSize: '16px',
  },
  alertBanner: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
    ...shorthands.padding('10px', '12px'),
    marginTop: '12px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: 'rgba(209, 52, 56, 0.1)',
    color: '#A4262C',
    fontSize: tokens.fontSizeBase200,
  },
  lastUpdated: {
    marginTop: '12px',
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground4,
  },
});

interface WeatherCondition {
  icon: React.ReactNode;
  emoji: string;
}

const weatherConditions: Record<string, WeatherCondition> = {
  'Clear': { icon: <WeatherSunny20Regular />, emoji: '☀️' },
  'Sunny': { icon: <WeatherSunny20Regular />, emoji: '☀️' },
  'Partly Cloudy': { icon: <WeatherCloudy20Regular />, emoji: '⛅' },
  'Mostly Cloudy': { icon: <WeatherCloudy20Regular />, emoji: '☁️' },
  'Cloudy': { icon: <WeatherCloudy20Regular />, emoji: '☁️' },
  'Overcast': { icon: <WeatherCloudy20Regular />, emoji: '☁️' },
  'Rain': { icon: <WeatherRain20Regular />, emoji: '🌧️' },
  'Light Rain': { icon: <WeatherRainShowersDay20Regular />, emoji: '🌦️' },
  'Heavy Rain': { icon: <WeatherRain20Regular />, emoji: '🌧️' },
  'Showers': { icon: <WeatherRainShowersDay20Regular />, emoji: '🌦️' },
  'Thunderstorm': { icon: <WeatherThunderstorm20Regular />, emoji: '⛈️' },
  'Snow': { icon: <WeatherSnow20Regular />, emoji: '❄️' },
  'Fog': { icon: <WeatherFog20Regular />, emoji: '🌫️' },
};

function getWeatherDisplay(conditions: string): WeatherCondition {
  // Try exact match first
  if (weatherConditions[conditions]) {
    return weatherConditions[conditions];
  }
  
  // Try partial match
  const lowerConditions = conditions.toLowerCase();
  if (lowerConditions.includes('thunder')) {
    return weatherConditions['Thunderstorm'];
  }
  if (lowerConditions.includes('rain') || lowerConditions.includes('shower')) {
    return weatherConditions['Rain'];
  }
  if (lowerConditions.includes('snow')) {
    return weatherConditions['Snow'];
  }
  if (lowerConditions.includes('cloud')) {
    return weatherConditions['Cloudy'];
  }
  if (lowerConditions.includes('fog') || lowerConditions.includes('mist')) {
    return weatherConditions['Fog'];
  }
  if (lowerConditions.includes('clear') || lowerConditions.includes('sunny')) {
    return weatherConditions['Clear'];
  }
  
  return { icon: <WeatherCloudy20Regular />, emoji: '🌤️' };
}

export interface WeatherHeroProps {
  /** Location name */
  location?: string;
  /** Current conditions text */
  conditions?: string;
  /** External temperature in display unit */
  temperature?: number | null;
  /** Temperature unit */
  unit?: 'fahrenheit' | 'celsius';
  /** Humidity percentage */
  humidity?: number | null;
  /** Wind speed in display unit */
  windSpeed?: number | null;
  /** Wind direction */
  windDirection?: string | null;
  /** Precipitation probability */
  precipitationChance?: number | null;
  /** Hive inner temperature for comparison */
  hiveInnerTemp?: number | null;
  /** Hive outer temperature for comparison */
  hiveOuterTemp?: number | null;
  /** Active weather alerts */
  alerts?: Array<{ event: string; severity: string }>;
  /** Last data update time */
  lastUpdated?: string;
  /** Compact display mode */
  compact?: boolean;
}

export function WeatherHero({
  location = 'Local Weather',
  conditions = 'Unknown',
  temperature,
  unit = 'fahrenheit',
  humidity,
  windSpeed,
  windDirection,
  precipitationChance,
  hiveInnerTemp,
  hiveOuterTemp,
  alerts = [],
  lastUpdated,
  compact = false,
}: WeatherHeroProps) {
  const styles = useStyles();
  
  const weatherDisplay = useMemo(() => getWeatherDisplay(conditions), [conditions]);
  const hasSevereAlerts = alerts.some(a => 
    a.severity === 'Extreme' || a.severity === 'Severe'
  );
  
  const unitSymbol = unit === 'fahrenheit' ? '°F' : '°C';
  
  // Calculate temperature deltas
  const innerDelta = useMemo(() => {
    if (temperature == null || hiveInnerTemp == null) return null;
    return hiveInnerTemp - temperature;
  }, [temperature, hiveInnerTemp]);

  const outerDelta = useMemo(() => {
    if (temperature == null || hiveOuterTemp == null) return null;
    return hiveOuterTemp - temperature;
  }, [temperature, hiveOuterTemp]);

  const formatDelta = (delta: number | null) => {
    if (delta === null) return null;
    const sign = delta >= 0 ? '+' : '';
    return `${sign}${delta.toFixed(1)}°`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={mergeClasses(
            styles.iconContainer,
            hasSevereAlerts && styles.iconSevere
          )}>
            {hasSevereAlerts ? <Warning20Regular /> : weatherDisplay.icon}
          </div>
          <div>
            <Text className={styles.label}>Weather</Text>
            <Text className={styles.locationText} block>{location}</Text>
          </div>
        </div>
        {precipitationChance != null && precipitationChance > 0 && (
          <Badge appearance="outline" color="informative">
            {precipitationChance}% rain
          </Badge>
        )}
      </div>

      <div className={styles.mainContent}>
        <span className={styles.weatherIcon}>{weatherDisplay.emoji}</span>
        <div className={styles.tempSection}>
          <Text className={styles.temperature}>
            {temperature != null ? `${Math.round(temperature)}${unitSymbol}` : '—'}
          </Text>
          <Text className={styles.conditions}>{conditions}</Text>
        </div>
      </div>

      {!compact && (hiveInnerTemp != null || hiveOuterTemp != null) && (
        <div className={styles.comparisonGrid}>
          <div className={styles.comparisonItem}>
            <Text className={styles.comparisonLabel}>Hive Inner</Text>
            <div className={styles.comparisonValue}>
              <span>{hiveInnerTemp != null ? `${hiveInnerTemp.toFixed(1)}${unitSymbol}` : '—'}</span>
              {innerDelta != null && (
                <Tooltip content={`${formatDelta(innerDelta)} vs external`} relationship="label">
                  <span className={innerDelta >= 0 ? styles.deltaPositive : styles.deltaNegative}>
                    {innerDelta >= 0 ? <ArrowUp16Regular /> : <ArrowDown16Regular />}
                    {Math.abs(innerDelta).toFixed(1)}°
                  </span>
                </Tooltip>
              )}
            </div>
          </div>
          <div className={styles.comparisonItem}>
            <Text className={styles.comparisonLabel}>Hive Outer</Text>
            <div className={styles.comparisonValue}>
              <span>{hiveOuterTemp != null ? `${hiveOuterTemp.toFixed(1)}${unitSymbol}` : '—'}</span>
              {outerDelta != null && (
                <Tooltip content={`${formatDelta(outerDelta)} vs external`} relationship="label">
                  <span className={outerDelta >= 0 ? styles.deltaPositive : styles.deltaNegative}>
                    {outerDelta >= 0 ? <ArrowUp16Regular /> : <ArrowDown16Regular />}
                    {Math.abs(outerDelta).toFixed(1)}°
                  </span>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      )}

      {!compact && (
        <div className={styles.detailsRow}>
          {humidity != null && (
            <div className={styles.detailItem}>
              <Drop20Regular className={styles.detailIcon} />
              <span>{humidity}% humidity</span>
            </div>
          )}
          {windSpeed != null && (
            <div className={styles.detailItem}>
              <ArrowSyncCircle20Regular className={styles.detailIcon} />
              <span>
                {windSpeed.toFixed(0)} {unit === 'fahrenheit' ? 'mph' : 'km/h'}
                {windDirection && ` ${windDirection}`}
              </span>
            </div>
          )}
        </div>
      )}

      {alerts.length > 0 && (
        <div className={styles.alertBanner}>
          <Warning20Regular />
          <Text>{alerts[0].event}</Text>
          {alerts.length > 1 && (
            <Badge appearance="filled" color="danger" size="small">
              +{alerts.length - 1}
            </Badge>
          )}
        </div>
      )}

      {lastUpdated && (
        <Text className={styles.lastUpdated}>
          Updated: {new Date(lastUpdated).toLocaleTimeString()}
        </Text>
      )}
    </div>
  );
}

export default WeatherHero;
