'use client';

import { useMemo } from 'react';
import { makeStyles, shorthands } from '@griffel/react';
import { Text } from '@fluentui/react-text';
import { tokens } from '@fluentui/react-theme';
import { 
  ArrowUp20Regular, 
  ArrowDown20Regular, 
  Subtract20Regular,
  Warning20Regular,
} from '@fluentui/react-icons';
import { 
  getTemperatureAlertLevel, 
  temperatureThresholds,
  alertColors,
  AlertLevel,
} from '../../lib/alert-thresholds';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    ...shorthands.padding('20px'),
    backgroundColor: tokens.colorNeutralBackground1,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    minWidth: '200px',
  },
  label: {
    color: tokens.colorNeutralForeground3,
    marginBottom: '8px',
    textTransform: 'uppercase',
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    letterSpacing: '0.5px',
  },
  gaugeContainer: {
    position: 'relative',
    width: '160px',
    height: '100px',
    marginBottom: '8px',
  },
  gauge: {
    width: '100%',
    height: '100%',
  },
  valueContainer: {
    display: 'flex',
    alignItems: 'baseline',
    ...shorthands.gap('4px'),
  },
  value: {
    fontSize: '48px',
    fontWeight: tokens.fontWeightBold,
    lineHeight: 1,
  },
  unit: {
    fontSize: tokens.fontSizeBase400,
    color: tokens.colorNeutralForeground3,
  },
  trend: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
    marginTop: '8px',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  trendUp: {
    color: '#D13438', // Warmer is usually concerning
  },
  trendDown: {
    color: '#0078D4', // Cooler
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
    marginTop: '4px',
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
  warning: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
    marginTop: '8px',
    color: '#FFB900',
    fontSize: tokens.fontSizeBase200,
  },
});

interface TemperatureHeroProps {
  current: number | null | undefined; // Temperature in Celsius
  currentF?: number | null | undefined; // Temperature in Fahrenheit (from database, preferred when available)
  type?: 'brood' | 'winter';
  trend?: number | null; // Change per hour
  label?: string;
  showGauge?: boolean;
  unit?: 'fahrenheit' | 'celsius';
}

export function TemperatureHero({
  current,
  currentF,
  type = 'brood',
  trend,
  label = 'Temperature',
  showGauge = true,
  unit = 'fahrenheit',
}: TemperatureHeroProps) {
  const styles = useStyles();
  const thresholds = temperatureThresholds[type];

  const alertLevel = useMemo(() => 
    getTemperatureAlertLevel(current, type),
    [current, type]
  );

  const alertColor = alertColors[alertLevel];
  
  // Convert to display unit - use native Fahrenheit from database when available
  const displayValue = useMemo(() => {
    if (unit === 'fahrenheit') {
      // Prefer native Fahrenheit from database
      if (currentF != null) return currentF;
      // Fallback to conversion
      if (current != null) return (current * 9/5) + 32;
      return null;
    }
    return current ?? null;
  }, [current, currentF, unit]);

  // Calculate gauge angles (semi-circle from -90 to 90 degrees)
  const gaugeData = useMemo(() => {
    if (current == null) return null;

    const min = thresholds.critical.min - 5;
    const max = thresholds.critical.max + 5;
    const range = max - min;
    const normalizedValue = (current - min) / range;
    const angle = -90 + (normalizedValue * 180);
    
    // Clamp angle
    const clampedAngle = Math.max(-90, Math.min(90, angle));

    return {
      angle: clampedAngle,
      optimalStart: ((thresholds.optimal.min - min) / range) * 180 - 90,
      optimalEnd: ((thresholds.optimal.max - min) / range) * 180 - 90,
      warningStart: ((thresholds.warning.min - min) / range) * 180 - 90,
      warningEnd: ((thresholds.warning.max - min) / range) * 180 - 90,
    };
  }, [current, thresholds]);

  const statusText = useMemo(() => {
    switch (alertLevel) {
      case 'optimal': return 'Optimal';
      case 'good': return 'Normal';
      case 'warning': return 'Warning';
      case 'critical': return 'Critical';
    }
  }, [alertLevel]);

  const TrendIcon = trend == null 
    ? Subtract20Regular 
    : trend > 0.5 
      ? ArrowUp20Regular 
      : trend < -0.5 
        ? ArrowDown20Regular 
        : Subtract20Regular;

  const trendClass = trend == null 
    ? '' 
    : trend > 0.5 
      ? styles.trendUp 
      : trend < -0.5 
        ? styles.trendDown 
        : '';

  // SVG arc path helper
  const describeArc = (
    cx: number, cy: number, r: number, 
    startAngle: number, endAngle: number
  ): string => {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };

  const polarToCartesian = (
    cx: number, cy: number, r: number, angle: number
  ) => {
    const angleRad = (angle - 90) * Math.PI / 180;
    return {
      x: cx + r * Math.cos(angleRad),
      y: cy + r * Math.sin(angleRad),
    };
  };

  return (
    <div className={styles.container}>
      <Text className={styles.label}>{label}</Text>
      
      {showGauge && gaugeData && (
        <div className={styles.gaugeContainer}>
          <svg viewBox="0 0 160 85" className={styles.gauge}>
            {/* Background arc */}
            <path
              d={describeArc(80, 80, 65, -90, 90)}
              fill="none"
              stroke={tokens.colorNeutralStroke2}
              strokeWidth="12"
              strokeLinecap="round"
            />
            
            {/* Warning zone (lower) */}
            <path
              d={describeArc(80, 80, 65, -90, gaugeData.warningStart)}
              fill="none"
              stroke="#FFB900"
              strokeWidth="12"
              strokeLinecap="round"
              opacity="0.6"
            />
            
            {/* Optimal zone */}
            <path
              d={describeArc(80, 80, 65, gaugeData.optimalStart, gaugeData.optimalEnd)}
              fill="none"
              stroke="#107C10"
              strokeWidth="12"
              strokeLinecap="round"
              opacity="0.6"
            />
            
            {/* Warning zone (upper) */}
            <path
              d={describeArc(80, 80, 65, gaugeData.warningEnd, 90)}
              fill="none"
              stroke="#FFB900"
              strokeWidth="12"
              strokeLinecap="round"
              opacity="0.6"
            />

            {/* Needle */}
            <g transform={`rotate(${gaugeData.angle}, 80, 80)`}>
              <line
                x1="80"
                y1="80"
                x2="80"
                y2="25"
                stroke={alertColor}
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle
                cx="80"
                cy="80"
                r="6"
                fill={alertColor}
              />
            </g>

            {/* Min/Max labels */}
            <text x="15" y="82" fontSize="10" fill={tokens.colorNeutralForeground3}>
              {thresholds.critical.min}°
            </text>
            <text x="135" y="82" fontSize="10" fill={tokens.colorNeutralForeground3}>
              {thresholds.critical.max}°
            </text>
          </svg>
        </div>
      )}

      <div className={styles.valueContainer}>
        <span className={styles.value} style={{ color: alertColor }}>
          {displayValue != null ? displayValue.toFixed(1) : '—'}
        </span>
        <span className={styles.unit}>{unit === 'fahrenheit' ? '°F' : '°C'}</span>
      </div>

      <div className={styles.status} style={{ color: alertColor }}>
        <span>●</span>
        <span>{statusText}</span>
      </div>

      {trend != null && (
        <div className={`${styles.trend} ${trendClass}`}>
          <TrendIcon />
          <span>{trend > 0 ? '+' : ''}{trend.toFixed(1)}°/hr</span>
        </div>
      )}

      {alertLevel === 'warning' || alertLevel === 'critical' ? (
        <div className={styles.warning}>
          <Warning20Regular />
          <span>
            {current != null && current < thresholds.optimal.min 
              ? 'Below optimal range' 
              : 'Above optimal range'}
          </span>
        </div>
      ) : null}
    </div>
  );
}