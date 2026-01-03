'use client';

import { useMemo } from 'react';
import { makeStyles, shorthands } from '@griffel/react';
import { Text } from '@fluentui/react-text';
import { Badge } from '@fluentui/react-badge';
import { tokens } from '@fluentui/react-theme';
import { 
  ArrowTrendingLines20Regular,
  ArrowRight20Regular,
  Warning20Regular,
  ArrowUp20Regular,
  ArrowDown20Regular,
} from '@fluentui/react-icons';
import { 
  detectWeightPattern, 
  getWeightAlertLevel,
  patternLabels,
  patternDescriptions,
  alertColors,
  WeightPattern,
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
    minWidth: '220px',
  },
  label: {
    color: tokens.colorNeutralForeground3,
    marginBottom: '8px',
    textTransform: 'uppercase',
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    letterSpacing: '0.5px',
  },
  valueContainer: {
    display: 'flex',
    alignItems: 'baseline',
    ...shorthands.gap('4px'),
    marginBottom: '4px',
  },
  value: {
    fontSize: '56px',
    fontWeight: tokens.fontWeightBold,
    lineHeight: 1,
    color: tokens.colorNeutralForeground1,
  },
  unit: {
    fontSize: tokens.fontSizeBase400,
    color: tokens.colorNeutralForeground3,
  },
  changeContainer: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('6px'),
    marginTop: '8px',
  },
  changePositive: {
    color: '#107C10',
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
  },
  changeNegative: {
    color: '#D13438',
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
  },
  changeNeutral: {
    color: tokens.colorNeutralForeground3,
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
  },
  patternBadge: {
    marginTop: '12px',
  },
  description: {
    marginTop: '8px',
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    textAlign: 'center',
    maxWidth: '200px',
  },
  sparklineContainer: {
    width: '100%',
    height: '40px',
    marginTop: '12px',
    marginBottom: '8px',
  },
  warning: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
    marginTop: '8px',
    color: '#FFB900',
    fontSize: tokens.fontSizeBase200,
  },
  critical: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
    marginTop: '8px',
    color: '#D13438',
    fontSize: tokens.fontSizeBase200,
  },
});

interface WeightHeroProps {
  currentKg: number | null | undefined;
  change24h?: number | null;
  changeRateKgPerHour?: number | null;
  recentValues?: number[]; // Last N values for sparkline
  label?: string;
}

export function WeightHero({
  currentKg,
  change24h,
  changeRateKgPerHour,
  recentValues,
  label = 'Weight',
}: WeightHeroProps) {
  const styles = useStyles();

  const pattern = useMemo(() => 
    detectWeightPattern(currentKg, change24h, changeRateKgPerHour),
    [currentKg, change24h, changeRateKgPerHour]
  );

  const alertLevel = useMemo(() => getWeightAlertLevel(pattern), [pattern]);
  const alertColor = alertColors[alertLevel];

  const ChangeIcon = change24h == null 
    ? ArrowRight20Regular
    : change24h > 0.1 
      ? ArrowUp20Regular 
      : change24h < -0.1 
        ? ArrowDown20Regular 
        : ArrowRight20Regular;

  const changeClass = change24h == null 
    ? styles.changeNeutral
    : change24h > 0.1 
      ? styles.changePositive 
      : change24h < -0.1 
        ? styles.changeNegative 
        : styles.changeNeutral;

  // Generate sparkline path
  const sparklinePath = useMemo(() => {
    if (!recentValues || recentValues.length < 2) return null;

    const width = 200;
    const height = 36;
    const padding = 4;

    const min = Math.min(...recentValues) - 0.5;
    const max = Math.max(...recentValues) + 0.5;
    const range = max - min || 1;

    const points = recentValues.map((value, index) => {
      const x = padding + (index / (recentValues.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((value - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  }, [recentValues]);

  // Badge appearance based on pattern
  const getBadgeColor = (p: WeightPattern): 'success' | 'warning' | 'danger' | 'informative' | 'subtle' => {
    switch (p) {
      case 'nectar-flow': return 'success';
      case 'swarm-detected': 
      case 'starvation-risk': return 'danger';
      case 'robbery-suspected': return 'warning';
      case 'winter-consumption': return 'informative';
      default: return 'subtle';
    }
  };

  return (
    <div className={styles.container}>
      <Text className={styles.label}>{label}</Text>

      {/* Sparkline */}
      {sparklinePath && (
        <div className={styles.sparklineContainer}>
          <svg viewBox="0 0 200 40" width="100%" height="100%">
            <path
              d={sparklinePath}
              fill="none"
              stroke={change24h != null && change24h >= 0 ? '#107C10' : '#D13438'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Current value dot */}
            {recentValues && recentValues.length > 0 && (
              <circle
                cx="196"
                cy={(() => {
                  const min = Math.min(...recentValues) - 0.5;
                  const max = Math.max(...recentValues) + 0.5;
                  const range = max - min || 1;
                  const lastValue = recentValues[recentValues.length - 1];
                  return 36 - 4 - ((lastValue - min) / range) * 28;
                })()}
                r="4"
                fill={change24h != null && change24h >= 0 ? '#107C10' : '#D13438'}
              />
            )}
          </svg>
        </div>
      )}

      <div className={styles.valueContainer}>
        <span className={styles.value}>
          {currentKg != null ? currentKg.toFixed(1) : '—'}
        </span>
        <span className={styles.unit}>kg</span>
      </div>

      {change24h != null && (
        <div className={styles.changeContainer}>
          <div className={changeClass}>
            <ChangeIcon />
            <Text size={300} weight="semibold">
              {change24h > 0 ? '+' : ''}{change24h.toFixed(2)} kg
            </Text>
          </div>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            (24h)
          </Text>
        </div>
      )}

      {pattern !== 'stable' && pattern !== 'unknown' && (
        <Badge 
          className={styles.patternBadge}
          color={getBadgeColor(pattern)}
          appearance="filled"
          size="medium"
        >
          {patternLabels[pattern]}
        </Badge>
      )}

      {pattern !== 'stable' && pattern !== 'unknown' && (
        <Text className={styles.description}>
          {patternDescriptions[pattern]}
        </Text>
      )}

      {alertLevel === 'warning' && (
        <div className={styles.warning}>
          <Warning20Regular />
          <span>Requires attention</span>
        </div>
      )}

      {alertLevel === 'critical' && (
        <div className={styles.critical}>
          <Warning20Regular />
          <span>Immediate action needed</span>
        </div>
      )}
    </div>
  );
}
