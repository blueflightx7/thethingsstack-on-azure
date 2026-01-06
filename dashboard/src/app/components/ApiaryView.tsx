'use client';

import { useState, useEffect, useMemo } from 'react';
import { makeStyles, shorthands, mergeClasses } from '@griffel/react';
import { tokens } from '@fluentui/react-theme';
import { Text, Title2, Title3 } from '@fluentui/react-text';
import { Card } from '@fluentui/react-card';
import { Spinner } from '@fluentui/react-spinner';
import { Badge } from '@fluentui/react-badge';
import { fetchJson, OverviewResponse, OverviewHive } from '../lib/api';
import { useUnitPreferences } from '../contexts/UnitPreferencesContext';
import { celsiusToFahrenheit, milligramsToKg, milligramsToLbs } from '../lib/units';
import { getTemperatureColor, getHiveStatusFromTemp, hiveStatusColors, hubColors } from '../lib/theme';

const useStyles = makeStyles({
  container: {
    ...shorthands.padding('24px'),
    backgroundColor: tokens.colorNeutralBackground2,
    minHeight: 'calc(100vh - 120px)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    ...shorthands.gap('16px'),
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('16px'),
  },
  headerIcon: {
    fontSize: '48px',
  },
  headerText: {
    display: 'flex',
    flexDirection: 'column',
  },
  subtitle: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase300,
  },
  apiaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    ...shorthands.gap('24px'),
    '@media (min-width: 1400px)': {
      gridTemplateColumns: 'repeat(4, 1fr)',
    },
    '@media (min-width: 2000px)': {
      gridTemplateColumns: 'repeat(5, 1fr)',
    },
  },
  hiveCard: {
    position: 'relative',
    ...shorthands.padding('0'),
    backgroundColor: tokens.colorNeutralBackground1,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    boxShadow: tokens.shadow8,
    borderRadius: tokens.borderRadiusLarge,
    overflow: 'hidden',
    cursor: 'pointer',
    transitionProperty: 'transform, box-shadow',
    transitionDuration: '0.2s',
    ':hover': {
      transform: 'translateY(-4px)',
      boxShadow: tokens.shadow16,
    },
  },
  hiveHeader: {
    background: `linear-gradient(135deg, ${hubColors.hubGradientStart} 0%, ${hubColors.hubGradientEnd} 100%)`,
    ...shorthands.padding('12px', '16px'),
    color: 'white',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hiveName: {
    fontWeight: 600,
    fontSize: '14px',
    color: 'white',
  },
  statusBadge: {
    fontSize: '10px',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  hiveVisual: {
    position: 'relative',
    height: '160px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDF6E3', // Warm honey background
    backgroundImage: `
      radial-gradient(circle at 20% 30%, rgba(255, 193, 7, 0.2) 0%, transparent 50%),
      radial-gradient(circle at 80% 70%, rgba(255, 152, 0, 0.15) 0%, transparent 50%)
    `,
  },
  hiveIllustration: {
    position: 'relative',
    width: '100px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  hiveRoof: {
    width: '110px',
    height: '25px',
    backgroundColor: '#8B4513',
    clipPath: 'polygon(0 100%, 50% 0, 100% 100%)',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  hiveBody: {
    position: 'relative',
    width: '100px',
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('2px'),
  },
  hiveBox: {
    width: '100px',
    height: '28px',
    backgroundColor: '#DEB887',
    border: '2px solid #8B4513',
    borderRadius: '2px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3), inset 0 -1px 2px rgba(0,0,0,0.1)',
  },
  hiveBoxInner: {
    width: '80%',
    height: '60%',
    backgroundColor: 'rgba(139, 69, 19, 0.2)',
    borderRadius: '1px',
  },
  hiveEntrance: {
    width: '30px',
    height: '8px',
    backgroundColor: '#654321',
    marginTop: '2px',
    borderRadius: '0 0 4px 4px',
    alignSelf: 'center',
  },
  hiveStand: {
    width: '90px',
    height: '12px',
    backgroundColor: '#654321',
    marginTop: '4px',
    borderRadius: '2px',
    alignSelf: 'center',
  },
  tempOverlay: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    ...shorthands.padding('6px', '10px'),
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('6px'),
  },
  tempIcon: {
    fontSize: '16px',
  },
  tempValue: {
    fontWeight: 700,
    fontSize: '18px',
  },
  weightOverlay: {
    position: 'absolute',
    bottom: '8px',
    left: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    ...shorthands.padding('4px', '8px'),
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
  },
  weightIcon: {
    fontSize: '14px',
  },
  weightValue: {
    fontWeight: 600,
    fontSize: '13px',
    color: tokens.colorNeutralForeground1,
  },
  humidityOverlay: {
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    ...shorthands.padding('4px', '8px'),
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
  },
  humidityIcon: {
    fontSize: '14px',
  },
  humidityValue: {
    fontWeight: 600,
    fontSize: '13px',
    color: '#0078D4',
  },
  hiveMetrics: {
    ...shorthands.padding('12px', '16px'),
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    ...shorthands.gap('8px'),
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  metric: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    ...shorthands.gap('2px'),
  },
  metricLabel: {
    fontSize: '10px',
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  metricValue: {
    fontWeight: 600,
    fontSize: '14px',
    color: tokens.colorNeutralForeground1,
  },
  lastSeen: {
    ...shorthands.padding('8px', '16px'),
    backgroundColor: tokens.colorNeutralBackground3,
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastSeenLabel: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
  },
  lastSeenValue: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground2,
  },
  beeAnimation: {
    position: 'absolute',
    fontSize: '14px',
    animation: 'bee-fly 3s ease-in-out infinite',
    '@keyframes bee-fly': {
      '0%, 100%': {
        transform: 'translate(0, 0) rotate(0deg)',
      },
      '25%': {
        transform: 'translate(10px, -5px) rotate(5deg)',
      },
      '50%': {
        transform: 'translate(5px, -10px) rotate(-5deg)',
      },
      '75%': {
        transform: 'translate(-5px, -3px) rotate(3deg)',
      },
    },
  },
  bee1: {
    top: '20%',
    left: '15%',
    animationDelay: '0s',
  },
  bee2: {
    top: '40%',
    right: '20%',
    animationDelay: '1s',
  },
  bee3: {
    bottom: '30%',
    left: '25%',
    animationDelay: '2s',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '300px',
  },
  emptyState: {
    textAlign: 'center',
    ...shorthands.padding('48px'),
  },
  legendContainer: {
    display: 'flex',
    ...shorthands.gap('16px'),
    flexWrap: 'wrap',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('6px'),
  },
  legendDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
  },
  legendText: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
  },
});

interface ApiaryViewProps {
  onHiveSelect?: (hiveId: string) => void;
}

export function ApiaryView({ onHiveSelect }: ApiaryViewProps) {
  const styles = useStyles();
  const { temperatureUnit, weightUnit } = useUnitPreferences();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const response = await fetchJson<OverviewResponse>('/api/overview');
        if (!cancelled) {
          setData(response);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load data');
          setLoading(false);
        }
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, []);

  const hives = useMemo(() => {
    if (!data?.hives) return [];
    return data.hives
      .filter(h => h.hiveIdentity)
      .map(h => ({
        ...h,
        // Map telemetry to easier-to-use computed properties
        latestTemperature: h.telemetry?.temperatureInner ?? null,
        latestTemperatureF: h.telemetry?.temperatureInnerF ?? null,
        latestWeight: h.telemetry?.weightKg ? h.telemetry.weightKg * 1000000 : null, // convert kg to mg
        latestHumidity: h.telemetry?.humidity ?? null,
        latestBattery: h.telemetry?.batteryPercent ?? null,
        latestSoundLevel: h.telemetry?.soundEnergyTotal ?? null,
        latestTimestamp: h.lastMeasurementAt ?? h.lastSeenAt ?? null,
      }));
  }, [data]);

  // Use native Fahrenheit from database when available, fallback to conversion
  const formatTemp = (tempC: number | null | undefined, tempF?: number | null | undefined): string => {
    if (temperatureUnit === 'fahrenheit') {
      // Use native Fahrenheit from database if available
      if (tempF != null) {
        return `${tempF.toFixed(0)}°F`;
      }
      // Fallback to conversion if Fahrenheit not stored
      if (tempC != null) {
        return `${celsiusToFahrenheit(tempC).toFixed(0)}°F`;
      }
      return '—';
    }
    if (tempC == null) return '—';
    return `${tempC.toFixed(0)}°C`;
  };

  const formatWeight = (mg: number | null | undefined): string => {
    if (mg == null) return '—';
    if (weightUnit === 'lbs') {
      return `${milligramsToLbs(mg).toFixed(1)} lbs`;
    }
    return `${milligramsToKg(mg).toFixed(1)} kg`;
  };

  const formatHumidity = (humidity: number | null | undefined): string => {
    if (humidity == null) return '—';
    return `${humidity.toFixed(0)}%`;
  };

  const formatLastSeen = (timestamp: string | null | undefined): string => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  type ExtendedHive = OverviewHive & {
    latestTemperature: number | null;
    latestTemperatureF: number | null;
    latestWeight: number | null;
    latestHumidity: number | null;
    latestBattery: number | null;
    latestSoundLevel: number | null;
    latestTimestamp: string | null;
  };

  const getStatusBadge = (hive: ExtendedHive) => {
    const status = getHiveStatusFromTemp(hive.latestTemperature, hive.latestTemperatureF);
    const statusConfig = {
      healthy: { color: 'success' as const, label: 'Healthy' },
      warning: { color: 'warning' as const, label: 'Warning' },
      critical: { color: 'danger' as const, label: 'Critical' },
      unknown: { color: 'informative' as const, label: 'No Data' },
    };
    return statusConfig[status];
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <Spinner size="large" label="Loading apiary data..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Text size={500}>⚠️ {error}</Text>
        </div>
      </div>
    );
  }

  if (hives.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Text size={500}>🐝 No hives found in the apiary</Text>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>🏡</span>
          <div className={styles.headerText}>
            <Title2>Microsoft NYC Apiary</Title2>
            <Text className={styles.subtitle}>
              {hives.length} hive{hives.length !== 1 ? 's' : ''} • Real-time monitoring
            </Text>
          </div>
        </div>
        
        <div className={styles.legendContainer}>
          <div className={styles.legendItem}>
            <div className={styles.legendDot} style={{ backgroundColor: hiveStatusColors.healthy.text }} />
            <Text className={styles.legendText}>Healthy (33-36°C)</Text>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendDot} style={{ backgroundColor: hiveStatusColors.warning.text }} />
            <Text className={styles.legendText}>Warning</Text>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendDot} style={{ backgroundColor: hiveStatusColors.critical.text }} />
            <Text className={styles.legendText}>Critical</Text>
          </div>
        </div>
      </div>

      <div className={styles.apiaryGrid}>
        {hives.map((hive, index) => {
          const status = getStatusBadge(hive);
          const tempColor = getTemperatureColor(hive.latestTemperature);
          
          return (
            <Card
              key={hive.hiveIdentity}
              className={styles.hiveCard}
              onClick={() => onHiveSelect?.(hive.hiveIdentity!)}
            >
              <div className={styles.hiveHeader}>
                <span className={styles.hiveName}>
                  {hive.hiveName || `Hive ${index + 1}`}
                </span>
                <Badge color={status.color} className={styles.statusBadge}>
                  {status.label}
                </Badge>
              </div>
              
              <div className={styles.hiveVisual}>
                {/* Animated bees */}
                <span className={mergeClasses(styles.beeAnimation, styles.bee1)}>🐝</span>
                <span className={mergeClasses(styles.beeAnimation, styles.bee2)}>🐝</span>
                <span className={mergeClasses(styles.beeAnimation, styles.bee3)}>🐝</span>
                
                {/* Stylized Hive Illustration */}
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
                
                {/* Temperature Overlay */}
                <div className={styles.tempOverlay}>
                  <span className={styles.tempIcon}>🌡️</span>
                  <span className={styles.tempValue} style={{ color: tempColor }}>
                    {formatTemp(hive.latestTemperature, hive.latestTemperatureF)}
                  </span>
                </div>
                
                {/* Weight Overlay */}
                <div className={styles.weightOverlay}>
                  <span className={styles.weightIcon}>⚖️</span>
                  <span className={styles.weightValue}>
                    {formatWeight(hive.latestWeight)}
                  </span>
                </div>
                
                {/* Humidity Overlay */}
                <div className={styles.humidityOverlay}>
                  <span className={styles.humidityIcon}>💧</span>
                  <span className={styles.humidityValue}>
                    {formatHumidity(hive.latestHumidity)}
                  </span>
                </div>
              </div>
              
              <div className={styles.hiveMetrics}>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Battery</span>
                  <span className={styles.metricValue}>
                    {hive.latestBattery != null ? `${hive.latestBattery.toFixed(0)}%` : '—'}
                  </span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Sound</span>
                  <span className={styles.metricValue}>
                    {hive.latestSoundLevel != null ? `${hive.latestSoundLevel.toFixed(0)} dB` : '—'}
                  </span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Readings</span>
                  <span className={styles.metricValue}>
                    {hive.deviceId ?? '—'}
                  </span>
                </div>
              </div>
              
              <div className={styles.lastSeen}>
                <span className={styles.lastSeenLabel}>Last update</span>
                <span className={styles.lastSeenValue}>
                  {formatLastSeen(hive.latestTimestamp)}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
