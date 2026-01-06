'use client';

import { useMemo } from 'react';
import { makeStyles, shorthands, mergeClasses } from '@griffel/react';
import { Text } from '@fluentui/react-text';
import { Badge } from '@fluentui/react-badge';
import { tokens } from '@fluentui/react-theme';
import { 
  ArrowTrendingLines20Regular,
  ArrowUp16Regular,
  ArrowDown16Regular,
  Subtract16Regular,
  CheckmarkCircle20Regular,
  Warning20Regular,
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
  nectarFlow: {
    borderLeft: '4px solid #107C10',
  },
  steady: {
    borderLeft: '4px solid #0078D4',
  },
  declining: {
    borderLeft: '4px solid #FFB900',
  },
  critical: {
    borderLeft: '4px solid #D13438',
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
    backgroundColor: 'rgba(255, 185, 0, 0.15)',
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
  mainDisplay: {
    display: 'flex',
    alignItems: 'flex-start',
    ...shorthands.gap('16px'),
    marginBottom: '16px',
  },
  honeyIcon: {
    fontSize: '56px',
    lineHeight: 1,
  },
  valueSection: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('4px'),
  },
  productionValue: {
    fontSize: '42px',
    fontWeight: tokens.fontWeightBold,
    lineHeight: 1,
    color: tokens.colorNeutralForeground1,
  },
  productionUnit: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
    marginLeft: '4px',
  },
  trendDisplay: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('6px'),
    marginTop: '4px',
  },
  trendPositive: {
    color: '#107C10',
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
    fontWeight: tokens.fontWeightSemibold,
  },
  trendNegative: {
    color: '#D13438',
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
    fontWeight: tokens.fontWeightSemibold,
  },
  trendNeutral: {
    color: tokens.colorNeutralForeground3,
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    ...shorthands.gap('12px'),
    marginTop: '8px',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    ...shorthands.gap('4px'),
    ...shorthands.padding('12px', '8px'),
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  statValue: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  statLabel: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    textAlign: 'center',
  },
  progressContainer: {
    marginTop: '16px',
  },
  progressLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '6px',
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  progressBar: {
    height: '8px',
    backgroundColor: tokens.colorNeutralBackground4,
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
    background: 'linear-gradient(90deg, #FFB900, #FF8C00)',
  },
  insightBanner: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
    ...shorthands.padding('10px', '12px'),
    marginTop: '12px',
    borderRadius: tokens.borderRadiusMedium,
    fontSize: tokens.fontSizeBase200,
  },
  insightPositive: {
    backgroundColor: 'rgba(16, 124, 16, 0.1)',
    color: '#0B6A0B',
  },
  insightNeutral: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground2,
  },
  insightWarning: {
    backgroundColor: 'rgba(255, 185, 0, 0.1)',
    color: '#8A6914',
  },
});

export type ProductionStatus = 'nectar-flow' | 'steady' | 'declining' | 'critical';

export interface HoneyProductionHeroProps {
  /** Current hive weight in display unit */
  currentWeight?: number | null;
  /** Weight unit */
  unit?: 'lbs' | 'kg';
  /** Daily weight change */
  dailyChange?: number | null;
  /** Weekly weight change */
  weeklyChange?: number | null;
  /** Estimated honey stores */
  estimatedHoneyStores?: number | null;
  /** Season-to-date production */
  seasonTotal?: number | null;
  /** Progress toward harvest goal (0-100) */
  harvestProgress?: number | null;
  /** Harvest goal */
  harvestGoal?: number | null;
  /** Production status */
  status?: ProductionStatus;
  /** Insight message */
  insight?: string;
  /** Compact display mode */
  compact?: boolean;
}

function getStatusConfig(status: ProductionStatus) {
  switch (status) {
    case 'nectar-flow':
      return {
        badge: 'Nectar Flow',
        badgeColor: 'success' as const,
        containerClass: 'nectarFlow',
      };
    case 'steady':
      return {
        badge: 'Steady',
        badgeColor: 'informative' as const,
        containerClass: 'steady',
      };
    case 'declining':
      return {
        badge: 'Declining',
        badgeColor: 'warning' as const,
        containerClass: 'declining',
      };
    case 'critical':
      return {
        badge: 'Low Stores',
        badgeColor: 'danger' as const,
        containerClass: 'critical',
      };
  }
}

export function HoneyProductionHero({
  currentWeight,
  unit = 'lbs',
  dailyChange,
  weeklyChange,
  estimatedHoneyStores,
  seasonTotal,
  harvestProgress,
  harvestGoal,
  status = 'steady',
  insight,
  compact = false,
}: HoneyProductionHeroProps) {
  const styles = useStyles();
  
  const statusConfig = getStatusConfig(status);
  
  const containerClass = mergeClasses(
    styles.container,
    (styles as Record<string, string>)[statusConfig.containerClass]
  );

  const TrendIcon = useMemo(() => {
    if (dailyChange == null) return Subtract16Regular;
    if (dailyChange > 0.1) return ArrowUp16Regular;
    if (dailyChange < -0.1) return ArrowDown16Regular;
    return Subtract16Regular;
  }, [dailyChange]);

  const trendClass = useMemo(() => {
    if (dailyChange == null) return styles.trendNeutral;
    if (dailyChange > 0.1) return styles.trendPositive;
    if (dailyChange < -0.1) return styles.trendNegative;
    return styles.trendNeutral;
  }, [dailyChange, styles]);

  const insightClass = useMemo(() => {
    switch (status) {
      case 'nectar-flow': return styles.insightPositive;
      case 'declining':
      case 'critical': return styles.insightWarning;
      default: return styles.insightNeutral;
    }
  }, [status, styles]);

  const unitLabel = unit === 'lbs' ? 'lbs' : 'kg';

  return (
    <div className={containerClass}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.iconContainer}>
            🍯
          </div>
          <div>
            <Text className={styles.label}>Honey Production</Text>
            <Text className={styles.title} block>Current Season</Text>
          </div>
        </div>
        <Badge appearance="filled" color={statusConfig.badgeColor}>
          {statusConfig.badge}
        </Badge>
      </div>

      <div className={styles.mainDisplay}>
        <span className={styles.honeyIcon}>🐝</span>
        <div className={styles.valueSection}>
          <div>
            <span className={styles.productionValue}>
              {seasonTotal != null ? seasonTotal.toFixed(1) : '—'}
            </span>
            <span className={styles.productionUnit}>{unitLabel}</span>
          </div>
          <Text style={{ color: tokens.colorNeutralForeground3 }}>Season Total</Text>
          
          {dailyChange != null && (
            <div className={styles.trendDisplay}>
              <div className={trendClass}>
                <TrendIcon />
                <span>{Math.abs(dailyChange).toFixed(2)} {unitLabel}/day</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {!compact && (
        <>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <Text className={styles.statValue}>
                {currentWeight != null ? currentWeight.toFixed(1) : '—'}
              </Text>
              <Text className={styles.statLabel}>Current Weight ({unitLabel})</Text>
            </div>
            <div className={styles.statItem}>
              <Text className={styles.statValue}>
                {weeklyChange != null ? 
                  `${weeklyChange >= 0 ? '+' : ''}${weeklyChange.toFixed(1)}` : 
                  '—'
                }
              </Text>
              <Text className={styles.statLabel}>7-Day Change</Text>
            </div>
            <div className={styles.statItem}>
              <Text className={styles.statValue}>
                {estimatedHoneyStores != null ? estimatedHoneyStores.toFixed(1) : '—'}
              </Text>
              <Text className={styles.statLabel}>Honey Stores ({unitLabel})</Text>
            </div>
          </div>

          {harvestProgress != null && harvestGoal != null && (
            <div className={styles.progressContainer}>
              <div className={styles.progressLabel}>
                <span>Harvest Goal Progress</span>
                <span>{harvestProgress.toFixed(0)}% of {harvestGoal} {unitLabel}</span>
              </div>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill}
                  style={{ width: `${Math.min(100, harvestProgress)}%` }}
                />
              </div>
            </div>
          )}

          {insight && (
            <div className={mergeClasses(styles.insightBanner, insightClass)}>
              {status === 'nectar-flow' || status === 'steady' ? (
                <CheckmarkCircle20Regular />
              ) : (
                <Warning20Regular />
              )}
              <Text>{insight}</Text>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default HoneyProductionHero;
