'use client';

import { makeStyles, shorthands, mergeClasses } from '@griffel/react';
import { tokens } from '@fluentui/react-theme';
import { OverviewResponse, OverviewHive } from '../../lib/api';
import { getTemperatureColor, hiveStatusColors } from '../../lib/theme';
import { useUnitPreferences } from '../../contexts/UnitPreferencesContext';
import { celsiusToFahrenheit } from '../../lib/units';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    ...shorthands.overflow('hidden'),
  },

  // Header
  header: {
    ...shorthands.padding('24px', '32px'),
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  headerLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
  },
  titleLight: {
    color: '#1a1a1a',
  },

  // Content
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.padding('24px'),
    ...shorthands.gap('24px'),
    ...shorthands.overflow('auto'),
  },

  // Chart section
  chartSection: {
    flex: 1,
    minHeight: '200px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    ...shorthands.padding('24px'),
    display: 'flex',
    flexDirection: 'column',
  },
  chartSectionLight: {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
  },
  chartTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: 'white',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('10px'),
  },
  chartTitleLight: {
    color: '#1a1a1a',
  },
  chartContent: {
    flex: 1,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    ...shorthands.gap('8px'),
    paddingTop: '16px',
  },

  // Temperature trend bars
  trendBar: {
    flex: 1,
    maxWidth: '60px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
  barContainer: {
    width: '100%',
    height: '150px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'flex-end',
    overflow: 'hidden',
  },
  barContainerLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  bar: {
    width: '100%',
    borderRadius: '10px 10px 0 0',
    transition: 'height 0.5s ease',
    minHeight: '4px',
  },
  barLabel: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  barLabelLight: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  barValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'white',
    textAlign: 'center',
  },
  barValueLight: {
    color: '#1a1a1a',
  },

  // Sound heatmap
  heatmapGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, 1fr)',
    gridTemplateRows: 'repeat(4, 1fr)',
    ...shorthands.gap('4px'),
    flex: 1,
    minHeight: '100px',
  },
  heatmapCell: {
    borderRadius: '4px',
    transition: 'all 0.3s ease',
  },
  heatmapLegend: {
    display: 'flex',
    justifyContent: 'center',
    ...shorthands.gap('24px'),
    marginTop: '16px',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  heatmapLegendLight: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  legendGradient: {
    width: '120px',
    height: '16px',
    borderRadius: '4px',
    background: 'linear-gradient(90deg, #107C10, #FFB900, #D83B01)',
  },

  // Statistics row
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    ...shorthands.gap('16px'),
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    ...shorthands.gap('4px'),
    ...shorthands.padding('16px'),
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
  },
  statItemLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 700,
    color: 'white',
  },
  statValueLight: {
    color: '#1a1a1a',
  },
  statLabel: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  statLabelLight: {
    color: 'rgba(0, 0, 0, 0.5)',
  },

  // No data
  noData: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    ...shorthands.gap('12px'),
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '16px',
  },
  noDataLight: {
    color: 'rgba(0, 0, 0, 0.3)',
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

interface ChartsZoneProps {
  hives: ExtendedHive[];
  isDark: boolean;
}

// Generate mock trend data (last 12 hours)
function generateTrendData(hive: ExtendedHive): number[] {
  const baseTemp = hive.latestTemperature ?? 35;
  const hash = hive.devEui?.charCodeAt(0) ?? 0;
  
  // Generate 12 data points with some variation
  return Array.from({ length: 12 }, (_, i) => {
    const variation = Math.sin((i + hash) * 0.5) * 2 + (Math.random() - 0.5);
    return Math.max(25, Math.min(45, baseTemp + variation));
  });
}

// Generate mock sound heatmap data
function generateHeatmapData(): number[][] {
  return Array.from({ length: 4 }, () =>
    Array.from({ length: 12 }, () => Math.random())
  );
}

function getSoundColor(value: number): string {
  if (value < 0.33) return '#107C10';
  if (value < 0.66) return '#FFB900';
  return '#D83B01';
}

export function ChartsZone({ hives, isDark }: ChartsZoneProps) {
  const styles = useStyles();
  const { temperatureUnit } = useUnitPreferences();

  // Aggregate statistics
  const temps = hives.map(h => h.latestTemperature).filter((t): t is number => t != null);
  const avgTemp = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
  const minTemp = temps.length > 0 ? Math.min(...temps) : null;
  const maxTemp = temps.length > 0 ? Math.max(...temps) : null;

  const formatTemp = (t: number | null): string => {
    if (t == null) return '—';
    if (temperatureUnit === 'fahrenheit') {
      return `${celsiusToFahrenheit(t).toFixed(0)}°F`;
    }
    return `${t.toFixed(1)}°C`;
  };

  // Get trend data for first hive or empty
  const trendData = hives.length > 0 ? generateTrendData(hives[0]) : [];
  const heatmapData = generateHeatmapData();
  
  // Calculate max value for bar height normalization
  const trendMax = Math.max(...trendData, 45);
  const trendMin = Math.min(...trendData, 25);
  const range = trendMax - trendMin || 1;

  const hours = ['12a', '2a', '4a', '6a', '8a', '10a', '12p', '2p', '4p', '6p', '8p', '10p'];

  return (
    <div className={styles.container}>
      <div className={mergeClasses(styles.header, !isDark && styles.headerLight)}>
        <span className={mergeClasses(styles.title, !isDark && styles.titleLight)}>
          📊 Analytics
        </span>
      </div>

      <div className={styles.content}>
        {/* Statistics Row */}
        <div className={styles.statsRow}>
          <div className={mergeClasses(styles.statItem, !isDark && styles.statItemLight)}>
            <span className={mergeClasses(styles.statValue, !isDark && styles.statValueLight)} style={{ color: '#107C10' }}>
              {formatTemp(avgTemp)}
            </span>
            <span className={mergeClasses(styles.statLabel, !isDark && styles.statLabelLight)}>Avg Temp</span>
          </div>
          <div className={mergeClasses(styles.statItem, !isDark && styles.statItemLight)}>
            <span className={mergeClasses(styles.statValue, !isDark && styles.statValueLight)} style={{ color: '#0078D4' }}>
              {formatTemp(minTemp)}
            </span>
            <span className={mergeClasses(styles.statLabel, !isDark && styles.statLabelLight)}>Min Temp</span>
          </div>
          <div className={mergeClasses(styles.statItem, !isDark && styles.statItemLight)}>
            <span className={mergeClasses(styles.statValue, !isDark && styles.statValueLight)} style={{ color: '#D83B01' }}>
              {formatTemp(maxTemp)}
            </span>
            <span className={mergeClasses(styles.statLabel, !isDark && styles.statLabelLight)}>Max Temp</span>
          </div>
        </div>

        {/* Temperature Trend */}
        <div className={mergeClasses(styles.chartSection, !isDark && styles.chartSectionLight)}>
          <span className={mergeClasses(styles.chartTitle, !isDark && styles.chartTitleLight)}>
            🌡️ Temperature Trend (24h)
          </span>
          <div className={styles.chartContent}>
            {trendData.length > 0 ? (
              trendData.map((temp, i) => {
                const height = ((temp - trendMin) / range) * 100;
                const color = getTemperatureColor(temp);
                return (
                  <div key={i} className={styles.trendBar}>
                    <span className={mergeClasses(styles.barValue, !isDark && styles.barValueLight)}>
                      {temp.toFixed(0)}°
                    </span>
                    <div className={mergeClasses(styles.barContainer, !isDark && styles.barContainerLight)}>
                      <div
                        className={styles.bar}
                        style={{ height: `${Math.max(height, 10)}%`, backgroundColor: color }}
                      />
                    </div>
                    <span className={mergeClasses(styles.barLabel, !isDark && styles.barLabelLight)}>
                      {hours[i]}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className={mergeClasses(styles.noData, !isDark && styles.noDataLight)}>
                <span>📉</span>
                <span>No trend data available</span>
              </div>
            )}
          </div>
        </div>

        {/* Sound Heatmap */}
        <div className={mergeClasses(styles.chartSection, !isDark && styles.chartSectionLight)}>
          <span className={mergeClasses(styles.chartTitle, !isDark && styles.chartTitleLight)}>
            🔊 Sound Activity Heatmap
          </span>
          <div className={styles.heatmapGrid}>
            {heatmapData.flat().map((value, i) => (
              <div
                key={i}
                className={styles.heatmapCell}
                style={{
                  backgroundColor: getSoundColor(value),
                  opacity: 0.5 + value * 0.5,
                }}
              />
            ))}
          </div>
          <div className={mergeClasses(styles.heatmapLegend, !isDark && styles.heatmapLegendLight)}>
            <span>Quiet</span>
            <div className={styles.legendGradient} />
            <span>Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
