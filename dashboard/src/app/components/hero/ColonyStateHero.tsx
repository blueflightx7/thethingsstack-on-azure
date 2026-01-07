'use client';

import { useMemo } from 'react';
import { makeStyles, shorthands, mergeClasses } from '@griffel/react';
import { Text } from '@fluentui/react-text';
import { Badge } from '@fluentui/react-badge';
import { tokens } from '@fluentui/react-theme';
import { 
  Home20Regular,
  Bug20Regular,
  PersonRunning20Regular,
  WeatherSnowflake20Regular,
  ArrowExportLtr20Regular,
  Question20Regular,
  ShieldCheckmark20Regular,
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
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
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
  iconNormal: {
    backgroundColor: 'rgba(0, 120, 212, 0.1)',
    color: '#0078D4',
  },
  iconActive: {
    backgroundColor: 'rgba(16, 124, 16, 0.1)',
    color: '#107C10',
  },
  iconSwarming: {
    backgroundColor: 'rgba(255, 185, 0, 0.1)',
    color: '#FFB900',
  },
  iconWinter: {
    backgroundColor: 'rgba(138, 136, 134, 0.1)',
    color: '#605E5C',
  },
  iconQueenless: {
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
  title: {
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase400,
  },
  stateDisplay: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
    marginBottom: '20px',
  },
  stateIcon: {
    fontSize: '56px',
  },
  stateText: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('4px'),
  },
  stateName: {
    fontSize: '28px',
    fontWeight: tokens.fontWeightBold,
    lineHeight: 1.1,
  },
  stateDescription: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  indicatorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    ...shorthands.gap('12px'),
    marginTop: '8px',
  },
  indicator: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    ...shorthands.gap('4px'),
    ...shorthands.padding('12px', '8px'),
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  indicatorActive: {
    backgroundColor: 'rgba(16, 124, 16, 0.08)',
    border: '1px solid rgba(16, 124, 16, 0.2)',
  },
  indicatorIcon: {
    fontSize: '20px',
    color: tokens.colorNeutralForeground2,
  },
  indicatorIconActive: {
    color: '#107C10',
  },
  indicatorLabel: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    textAlign: 'center',
  },
  confidenceMeter: {
    marginTop: '16px',
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('6px'),
  },
  confidenceLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  confidenceBar: {
    height: '6px',
    backgroundColor: tokens.colorNeutralBackground4,
    borderRadius: '3px',
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  confidenceHigh: {
    backgroundColor: '#107C10',
  },
  confidenceMedium: {
    backgroundColor: '#FFB900',
  },
  confidenceLow: {
    backgroundColor: '#D13438',
  },
});

export type ColonyState = 
  | 'normal' 
  | 'foraging' 
  | 'swarming' 
  | 'winter-cluster' 
  | 'queenless' 
  | 'brood-rearing'
  | 'unknown';

interface StateConfig {
  icon: React.ReactNode;
  iconStyle: string;
  label: string;
  description: string;
  badgeColor: 'success' | 'warning' | 'danger' | 'informative' | 'subtle';
}

export interface ColonyStateHeroProps {
  /** Current detected state of the colony */
  state: ColonyState;
  /** Confidence level 0-100 of the state detection */
  confidence?: number;
  /** Whether queen presence is confirmed */
  queenPresent?: boolean;
  /** Whether there's active brood */
  broodActive?: boolean;
  /** Whether foragers are active */
  foragingActive?: boolean;
  /** Compact display mode */
  compact?: boolean;
}

const stateConfigs: Record<ColonyState, StateConfig> = {
  normal: {
    icon: '🐝',
    iconStyle: 'iconNormal',
    label: 'Normal Activity',
    description: 'Colony operating within expected parameters',
    badgeColor: 'success',
  },
  foraging: {
    icon: '🌸',
    iconStyle: 'iconActive',
    label: 'Active Foraging',
    description: 'High forager activity detected',
    badgeColor: 'success',
  },
  swarming: {
    icon: '⚠️',
    iconStyle: 'iconSwarming',
    label: 'Swarm Behavior',
    description: 'Swarming preparations detected',
    badgeColor: 'warning',
  },
  'winter-cluster': {
    icon: '❄️',
    iconStyle: 'iconWinter',
    label: 'Winter Cluster',
    description: 'Colony in winter cluster mode',
    badgeColor: 'informative',
  },
  queenless: {
    icon: '👑',
    iconStyle: 'iconQueenless',
    label: 'Queenless',
    description: 'No queen activity detected',
    badgeColor: 'danger',
  },
  'brood-rearing': {
    icon: '🥚',
    iconStyle: 'iconActive',
    label: 'Brood Rearing',
    description: 'Active brood development',
    badgeColor: 'success',
  },
  unknown: {
    icon: '❓',
    iconStyle: 'iconNormal',
    label: 'Unknown',
    description: 'Insufficient data to determine state',
    badgeColor: 'subtle',
  },
};

export function ColonyStateHero({
  state,
  confidence = 0,
  queenPresent,
  broodActive,
  foragingActive,
  compact = false,
}: ColonyStateHeroProps) {
  const styles = useStyles();
  
  const config = stateConfigs[state];
  
  const iconContainerClass = mergeClasses(
    styles.iconContainer,
    (styles as Record<string, string>)[config.iconStyle]
  );

  const confidenceClass = useMemo(() => {
    if (confidence >= 80) return styles.confidenceHigh;
    if (confidence >= 50) return styles.confidenceMedium;
    return styles.confidenceLow;
  }, [confidence, styles]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={iconContainerClass}>
            <Home20Regular />
          </div>
          <div>
            <Text className={styles.label}>Colony State</Text>
            <Text className={styles.title} block>Current Activity</Text>
          </div>
        </div>
        <Badge 
          appearance="filled" 
          color={config.badgeColor}
        >
          {config.label}
        </Badge>
      </div>

      <div className={styles.stateDisplay}>
        <span className={styles.stateIcon}>{config.icon}</span>
        <div className={styles.stateText}>
          <Text className={styles.stateName}>{config.label}</Text>
          <Text className={styles.stateDescription}>{config.description}</Text>
        </div>
      </div>

      {!compact && (
        <>
          <div className={styles.indicatorGrid}>
            <div className={mergeClasses(
              styles.indicator,
              queenPresent && styles.indicatorActive
            )}>
              <ShieldCheckmark20Regular className={mergeClasses(
                styles.indicatorIcon,
                queenPresent && styles.indicatorIconActive
              )} />
              <Text className={styles.indicatorLabel}>
                Queen {queenPresent ? 'Present' : queenPresent === false ? 'Absent' : '?'}
              </Text>
            </div>
            <div className={mergeClasses(
              styles.indicator,
              broodActive && styles.indicatorActive
            )}>
              <Bug20Regular className={mergeClasses(
                styles.indicatorIcon,
                broodActive && styles.indicatorIconActive
              )} />
              <Text className={styles.indicatorLabel}>
                Brood {broodActive ? 'Active' : broodActive === false ? 'None' : '?'}
              </Text>
            </div>
            <div className={mergeClasses(
              styles.indicator,
              foragingActive && styles.indicatorActive
            )}>
              <PersonRunning20Regular className={mergeClasses(
                styles.indicatorIcon,
                foragingActive && styles.indicatorIconActive
              )} />
              <Text className={styles.indicatorLabel}>
                Foraging {foragingActive ? 'Active' : foragingActive === false ? 'Low' : '?'}
              </Text>
            </div>
          </div>

          {confidence > 0 && (
            <div className={styles.confidenceMeter}>
              <div className={styles.confidenceLabel}>
                <span>Detection Confidence</span>
                <span>{confidence}%</span>
              </div>
              <div className={styles.confidenceBar}>
                <div 
                  className={mergeClasses(styles.confidenceFill, confidenceClass)}
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ColonyStateHero;
