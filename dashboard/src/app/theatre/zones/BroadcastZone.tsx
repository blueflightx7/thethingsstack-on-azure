'use client';

import { makeStyles, shorthands, mergeClasses } from '@griffel/react';
import { tokens } from '@fluentui/react-theme';
import { Text, Title1, Title2, Title3 } from '@fluentui/react-text';
import { Button } from '@fluentui/react-button';
import { Badge } from '@fluentui/react-badge';
import {
  ArrowLeft32Regular,
  ArrowRight32Regular,
  Temperature24Regular,
} from '@fluentui/react-icons';
import { OverviewResponse, OverviewHive } from '../../lib/api';
import { hubColors, getTemperatureColor, getHiveStatusFromTemp, hiveStatusColors } from '../../lib/theme';
import { useUnitPreferences } from '../../contexts/UnitPreferencesContext';
import { celsiusToFahrenheit, milligramsToKg, milligramsToLbs } from '../../lib/units';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    ...shorthands.padding('0'),
  },
  
  // Header section
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding('32px', '48px'),
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  headerLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('24px'),
  },
  hiveName: {
    fontSize: '48px',
    fontWeight: 700,
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('20px'),
  },
  hiveNameLight: {
    color: '#1a1a1a',
  },
  statusBadge: {
    fontSize: '18px',
    ...shorthands.padding('12px', '24px'),
    ...shorthands.borderRadius('24px'),
    fontWeight: 600,
  },
  navigation: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('16px'),
  },
  navButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    color: 'white',
    minWidth: '64px',
    minHeight: '64px',
    ...shorthands.borderRadius('12px'),
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
  },
  navButtonLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    color: '#1a1a1a',
    ':hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.15)',
    },
  },
  hiveIndicator: {
    fontSize: '24px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.8)',
    minWidth: '100px',
    textAlign: 'center',
  },
  hiveIndicatorLight: {
    color: 'rgba(0, 0, 0, 0.6)',
  },

  // Content area
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.padding('48px'),
    ...shorthands.gap('48px'),
    overflow: 'auto',
  },

  // Stats grid - large format for distance viewing
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    ...shorthands.gap('32px'),
  },
  statCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    ...shorthands.borderRadius('24px'),
    ...shorthands.padding('40px'),
    border: '1px solid rgba(255, 255, 255, 0.1)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    ...shorthands.gap('16px'),
  },
  statCardLight: {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
  statIcon: {
    fontSize: '48px',
  },
  statValue: {
    fontSize: '72px',
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: '-2px',
  },
  statLabel: {
    fontSize: '20px',
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    fontWeight: 500,
  },
  statLabelLight: {
    color: 'rgba(0, 0, 0, 0.5)',
  },

  // Hive visual section
  hiveVisualSection: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...shorthands.gap('64px'),
  },
  hiveIllustration: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    transform: 'scale(2)',
    transformOrigin: 'center center',
  },
  hiveRoof: {
    width: '160px',
    height: '40px',
    backgroundColor: '#8B4513',
    clipPath: 'polygon(0 100%, 50% 0, 100% 100%)',
    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
  },
  hiveBody: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('4px'),
  },
  hiveBox: {
    width: '150px',
    height: '45px',
    backgroundColor: '#DEB887',
    border: '3px solid #8B4513',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.1)',
  },
  hiveBoxInner: {
    width: '80%',
    height: '60%',
    backgroundColor: 'rgba(139, 69, 19, 0.2)',
    borderRadius: '2px',
  },
  hiveEntrance: {
    width: '45px',
    height: '12px',
    backgroundColor: '#654321',
    marginTop: '4px',
    borderRadius: '0 0 6px 6px',
  },
  hiveStand: {
    width: '140px',
    height: '18px',
    backgroundColor: '#654321',
    marginTop: '6px',
    borderRadius: '4px',
  },

  // Metrics panel
  metricsPanel: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('24px'),
    minWidth: '400px',
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding('20px', '28px'),
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    ...shorthands.borderRadius('16px'),
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  metricRowLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
  },
  metricLabel: {
    fontSize: '20px',
    color: 'rgba(255, 255, 255, 0.7)',
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
  },
  metricLabelLight: {
    color: 'rgba(0, 0, 0, 0.6)',
  },
  metricValue: {
    fontSize: '32px',
    fontWeight: 700,
    color: 'white',
  },
  metricValueLight: {
    color: '#1a1a1a',
  },

  // No data state
  noData: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    ...shorthands.gap('24px'),
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '32px',
  },
  noDataLight: {
    color: 'rgba(0, 0, 0, 0.4)',
  },
});

interface ExtendedHive extends OverviewHive {
  latestTemperature: number | null;
  latestTemperatureF: number | null;
  latestWeight: number | null;
  latestHumidity: number | null;
  latestBattery: number | null;
  latestSoundLevel: number | null;
  latestTimestamp: string | null;
}

interface BroadcastZoneProps {
  hive: ExtendedHive | null;
  hiveIndex: number;
  totalHives: number;
  data: OverviewResponse | null;
  onPrev: () => void;
  onNext: () => void;
  isPaused: boolean;
  isDark: boolean;
}

export function BroadcastZone({
  hive,
  hiveIndex,
  totalHives,
  data,
  onPrev,
  onNext,
  isPaused,
  isDark,
}: BroadcastZoneProps) {
  const styles = useStyles();
  const { temperatureUnit, weightUnit } = useUnitPreferences();

  // Format temperature
  const formatTemp = (tempC: number | null, tempF?: number | null): string => {
    if (temperatureUnit === 'fahrenheit') {
      if (tempF != null) return `${tempF.toFixed(0)}°F`;
      if (tempC != null) return `${celsiusToFahrenheit(tempC).toFixed(0)}°F`;
      return '—';
    }
    if (tempC == null) return '—';
    return `${tempC.toFixed(1)}°C`;
  };

  // Format weight
  const formatWeight = (weightMg: number | null): string => {
    if (weightMg == null) return '—';
    const kg = milligramsToKg(weightMg);
    if (weightUnit === 'lbs') {
      return `${milligramsToLbs(weightMg).toFixed(1)} lbs`;
    }
    return `${kg.toFixed(1)} kg`;
  };

  // Get status
  const getStatus = () => {
    if (!hive) return { color: 'informative' as const, label: 'No Data' };
    const status = getHiveStatusFromTemp(hive.latestTemperature, hive.latestTemperatureF);
    const config = {
      healthy: { color: 'success' as const, label: 'Healthy' },
      warning: { color: 'warning' as const, label: 'Warning' },
      critical: { color: 'danger' as const, label: 'Critical' },
      unknown: { color: 'informative' as const, label: 'No Data' },
    };
    return config[status];
  };

  const status = getStatus();
  const tempColor = hive ? getTemperatureColor(hive.latestTemperature) : '#666';

  if (!hive) {
    return (
      <div className={styles.container}>
        <div className={mergeClasses(styles.noData, !isDark && styles.noDataLight)}>
          <span style={{ fontSize: '64px' }}>🐝</span>
          <span>No hive data available</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={mergeClasses(styles.header, !isDark && styles.headerLight)}>
        <div className={styles.headerLeft}>
          <span className={mergeClasses(styles.hiveName, !isDark && styles.hiveNameLight)}>
            🏠 {hive.hiveName || `Hive ${hiveIndex + 1}`}
          </span>
          <Badge color={status.color} className={styles.statusBadge}>
            {status.label}
          </Badge>
        </div>
        <div className={styles.navigation}>
          <Button
            className={mergeClasses(styles.navButton, !isDark && styles.navButtonLight)}
            icon={<ArrowLeft32Regular />}
            onClick={onPrev}
            disabled={totalHives <= 1}
          />
          <span className={mergeClasses(styles.hiveIndicator, !isDark && styles.hiveIndicatorLight)}>
            {hiveIndex + 1} / {totalHives}
          </span>
          <Button
            className={mergeClasses(styles.navButton, !isDark && styles.navButtonLight)}
            icon={<ArrowRight32Regular />}
            onClick={onNext}
            disabled={totalHives <= 1}
          />
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={mergeClasses(styles.statCard, !isDark && styles.statCardLight)}>
            <span className={styles.statIcon}>🌡️</span>
            <span className={styles.statValue} style={{ color: tempColor }}>
              {formatTemp(hive.latestTemperature, hive.latestTemperatureF)}
            </span>
            <span className={mergeClasses(styles.statLabel, !isDark && styles.statLabelLight)}>
              Temperature
            </span>
          </div>
          <div className={mergeClasses(styles.statCard, !isDark && styles.statCardLight)}>
            <span className={styles.statIcon}>💧</span>
            <span className={styles.statValue} style={{ color: '#0078D4' }}>
              {hive.latestHumidity != null ? `${hive.latestHumidity.toFixed(0)}%` : '—'}
            </span>
            <span className={mergeClasses(styles.statLabel, !isDark && styles.statLabelLight)}>
              Humidity
            </span>
          </div>
          <div className={mergeClasses(styles.statCard, !isDark && styles.statCardLight)}>
            <span className={styles.statIcon}>⚖️</span>
            <span className={styles.statValue} style={{ color: '#FFB900' }}>
              {formatWeight(hive.latestWeight)}
            </span>
            <span className={mergeClasses(styles.statLabel, !isDark && styles.statLabelLight)}>
              Weight
            </span>
          </div>
          <div className={mergeClasses(styles.statCard, !isDark && styles.statCardLight)}>
            <span className={styles.statIcon}>🔋</span>
            <span className={styles.statValue} style={{ color: '#107C10' }}>
              {hive.latestBattery != null ? `${hive.latestBattery.toFixed(0)}%` : '—'}
            </span>
            <span className={mergeClasses(styles.statLabel, !isDark && styles.statLabelLight)}>
              Battery
            </span>
          </div>
        </div>

        {/* Hive Visual Section */}
        <div className={styles.hiveVisualSection}>
          {/* Hive Illustration */}
          <div className={styles.hiveIllustration}>
            <div className={styles.hiveRoof} />
            <div className={styles.hiveBody}>
              <div className={styles.hiveBox}>
                <div className={styles.hiveBoxInner} />
              </div>
              <div className={styles.hiveBox}>
                <div className={styles.hiveBoxInner} />
              </div>
              <div className={styles.hiveBox}>
                <div className={styles.hiveBoxInner} />
              </div>
            </div>
            <div className={styles.hiveEntrance} />
            <div className={styles.hiveStand} />
          </div>

          {/* Metrics Panel */}
          <div className={styles.metricsPanel}>
            <div className={mergeClasses(styles.metricRow, !isDark && styles.metricRowLight)}>
              <span className={mergeClasses(styles.metricLabel, !isDark && styles.metricLabelLight)}>
                🔊 Sound Level
              </span>
              <span className={mergeClasses(styles.metricValue, !isDark && styles.metricValueLight)}>
                {hive.latestSoundLevel != null ? `${hive.latestSoundLevel.toFixed(0)} dB` : '—'}
              </span>
            </div>
            <div className={mergeClasses(styles.metricRow, !isDark && styles.metricRowLight)}>
              <span className={mergeClasses(styles.metricLabel, !isDark && styles.metricLabelLight)}>
                📡 Device ID
              </span>
              <span className={mergeClasses(styles.metricValue, !isDark && styles.metricValueLight)}>
                {hive.devEui?.slice(-8) || '—'}
              </span>
            </div>
            <div className={mergeClasses(styles.metricRow, !isDark && styles.metricRowLight)}>
              <span className={mergeClasses(styles.metricLabel, !isDark && styles.metricLabelLight)}>
                ⏱️ Last Update
              </span>
              <span className={mergeClasses(styles.metricValue, !isDark && styles.metricValueLight)}>
                {hive.latestTimestamp 
                  ? new Date(hive.latestTimestamp).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: false 
                    })
                  : '—'
                }
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
