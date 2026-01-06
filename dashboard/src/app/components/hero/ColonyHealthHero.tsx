'use client';

import { useMemo } from 'react';
import { makeStyles, shorthands, mergeClasses } from '@griffel/react';
import { Text, Title2 } from '@fluentui/react-text';
import { Badge } from '@fluentui/react-badge';
import { tokens } from '@fluentui/react-theme';
import { 
  Heart20Regular,
  HeartPulse20Regular,
  Checkmark20Regular,
  Warning20Regular,
  ErrorCircle20Regular,
  Question20Regular,
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
    minWidth: '280px',
    position: 'relative',
    overflow: 'hidden',
  },
  healthy: {
    borderLeft: '4px solid #107C10',
    '::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      right: 0,
      width: '100px',
      height: '100px',
      background: 'radial-gradient(circle at top right, rgba(16, 124, 16, 0.08), transparent 70%)',
    },
  },
  warning: {
    borderLeft: '4px solid #FFB900',
    '::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      right: 0,
      width: '100px',
      height: '100px',
      background: 'radial-gradient(circle at top right, rgba(255, 185, 0, 0.08), transparent 70%)',
    },
  },
  critical: {
    borderLeft: '4px solid #D13438',
    '::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      right: 0,
      width: '100px',
      height: '100px',
      background: 'radial-gradient(circle at top right, rgba(209, 52, 56, 0.08), transparent 70%)',
    },
  },
  unknown: {
    borderLeft: '4px solid #8A8886',
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
  },
  iconHealthy: {
    backgroundColor: 'rgba(16, 124, 16, 0.1)',
    color: '#107C10',
  },
  iconWarning: {
    backgroundColor: 'rgba(255, 185, 0, 0.1)',
    color: '#FFB900',
  },
  iconCritical: {
    backgroundColor: 'rgba(209, 52, 56, 0.1)',
    color: '#D13438',
  },
  iconUnknown: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground3,
  },
  label: {
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    letterSpacing: '0.5px',
  },
  title: {
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  scoreContainer: {
    display: 'flex',
    alignItems: 'baseline',
    ...shorthands.gap('4px'),
    marginBottom: '16px',
  },
  score: {
    fontSize: '64px',
    fontWeight: tokens.fontWeightBold,
    lineHeight: 1,
  },
  scoreHealthy: {
    color: '#107C10',
  },
  scoreWarning: {
    color: '#FFB900',
  },
  scoreCritical: {
    color: '#D13438',
  },
  scoreUnknown: {
    color: tokens.colorNeutralForeground3,
  },
  scoreMax: {
    fontSize: tokens.fontSizeBase400,
    color: tokens.colorNeutralForeground3,
    marginLeft: '4px',
  },
  statusText: {
    marginTop: '8px',
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    ...shorthands.gap('12px'),
    marginTop: '16px',
  },
  metric: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('2px'),
  },
  metricLabel: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  metricValue: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
  },
  metricGood: {
    color: '#107C10',
  },
  metricWarning: {
    color: '#FFB900',
  },
  metricCritical: {
    color: '#D13438',
  },
  alertBanner: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
    ...shorthands.padding('12px'),
    marginTop: '16px',
    borderRadius: tokens.borderRadiusMedium,
    fontSize: tokens.fontSizeBase200,
  },
  alertWarning: {
    backgroundColor: 'rgba(255, 185, 0, 0.1)',
    color: '#8A6914',
  },
  alertCritical: {
    backgroundColor: 'rgba(209, 52, 56, 0.1)',
    color: '#A4262C',
  },
});

export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

interface MetricStatus {
  value: string;
  status: 'good' | 'warning' | 'critical';
}

export interface ColonyHealthHeroProps {
  /** Overall health score 0-100 */
  score: number | null;
  /** Status derived from score */
  status?: HealthStatus;
  /** Individual metric statuses */
  metrics?: {
    temperature?: MetricStatus;
    humidity?: MetricStatus;
    weight?: MetricStatus;
    activity?: MetricStatus;
  };
  /** Primary alert message if any */
  alertMessage?: string;
  /** Compact display mode */
  compact?: boolean;
}

function calculateStatus(score: number | null): HealthStatus {
  if (score === null) return 'unknown';
  if (score >= 80) return 'healthy';
  if (score >= 50) return 'warning';
  return 'critical';
}

export function ColonyHealthHero({
  score,
  status: statusOverride,
  metrics,
  alertMessage,
  compact = false,
}: ColonyHealthHeroProps) {
  const styles = useStyles();
  
  const status = statusOverride ?? calculateStatus(score);
  
  const StatusIcon = useMemo(() => {
    switch (status) {
      case 'healthy': return HeartPulse20Regular;
      case 'warning': return Warning20Regular;
      case 'critical': return ErrorCircle20Regular;
      default: return Question20Regular;
    }
  }, [status]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case 'healthy': return 'Healthy';
      case 'warning': return 'Needs Attention';
      case 'critical': return 'Critical';
      default: return 'Unknown';
    }
  }, [status]);

  const containerClass = mergeClasses(
    styles.container,
    status === 'healthy' && styles.healthy,
    status === 'warning' && styles.warning,
    status === 'critical' && styles.critical,
    status === 'unknown' && styles.unknown
  );

  const iconClass = mergeClasses(
    styles.iconContainer,
    status === 'healthy' && styles.iconHealthy,
    status === 'warning' && styles.iconWarning,
    status === 'critical' && styles.iconCritical,
    status === 'unknown' && styles.iconUnknown
  );

  const scoreClass = mergeClasses(
    styles.score,
    status === 'healthy' && styles.scoreHealthy,
    status === 'warning' && styles.scoreWarning,
    status === 'critical' && styles.scoreCritical,
    status === 'unknown' && styles.scoreUnknown
  );

  const getMetricClass = (metricStatus: 'good' | 'warning' | 'critical') => {
    switch (metricStatus) {
      case 'good': return styles.metricGood;
      case 'warning': return styles.metricWarning;
      case 'critical': return styles.metricCritical;
    }
  };

  return (
    <div className={containerClass}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={iconClass}>
            <StatusIcon />
          </div>
          <div>
            <Text className={styles.label}>Colony Health</Text>
            <Text className={styles.title} block>{statusLabel}</Text>
          </div>
        </div>
        <Badge 
          appearance="filled" 
          color={status === 'healthy' ? 'success' : status === 'warning' ? 'warning' : status === 'critical' ? 'danger' : 'informative'}
        >
          {status === 'healthy' ? 'Good' : status === 'warning' ? 'Monitor' : status === 'critical' ? 'Action Required' : 'No Data'}
        </Badge>
      </div>

      <div className={styles.scoreContainer}>
        <span className={scoreClass}>
          {score !== null ? score : '—'}
        </span>
        {score !== null && <span className={styles.scoreMax}>/100</span>}
      </div>

      {!compact && metrics && (
        <div className={styles.metricsGrid}>
          {metrics.temperature && (
            <div className={styles.metric}>
              <Text className={styles.metricLabel}>Temperature</Text>
              <Text className={mergeClasses(styles.metricValue, getMetricClass(metrics.temperature.status))}>
                {metrics.temperature.value}
              </Text>
            </div>
          )}
          {metrics.humidity && (
            <div className={styles.metric}>
              <Text className={styles.metricLabel}>Humidity</Text>
              <Text className={mergeClasses(styles.metricValue, getMetricClass(metrics.humidity.status))}>
                {metrics.humidity.value}
              </Text>
            </div>
          )}
          {metrics.weight && (
            <div className={styles.metric}>
              <Text className={styles.metricLabel}>Weight</Text>
              <Text className={mergeClasses(styles.metricValue, getMetricClass(metrics.weight.status))}>
                {metrics.weight.value}
              </Text>
            </div>
          )}
          {metrics.activity && (
            <div className={styles.metric}>
              <Text className={styles.metricLabel}>Activity</Text>
              <Text className={mergeClasses(styles.metricValue, getMetricClass(metrics.activity.status))}>
                {metrics.activity.value}
              </Text>
            </div>
          )}
        </div>
      )}

      {alertMessage && (status === 'warning' || status === 'critical') && (
        <div className={mergeClasses(
          styles.alertBanner,
          status === 'warning' ? styles.alertWarning : styles.alertCritical
        )}>
          {status === 'critical' ? <ErrorCircle20Regular /> : <Warning20Regular />}
          <Text>{alertMessage}</Text>
        </div>
      )}
    </div>
  );
}

export default ColonyHealthHero;
