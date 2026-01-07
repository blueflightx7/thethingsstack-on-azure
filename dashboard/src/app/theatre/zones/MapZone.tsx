'use client';

import { makeStyles, shorthands, mergeClasses } from '@griffel/react';
import { tokens } from '@fluentui/react-theme';
import { Text } from '@fluentui/react-text';
import { Badge } from '@fluentui/react-badge';
import { OverviewResponse, OverviewHive } from '../../lib/api';
import { getTemperatureColor, getHiveStatusFromTemp, hiveStatusColors } from '../../lib/theme';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    position: 'relative',
    ...shorthands.overflow('hidden'),
  },
  
  // Header
  header: {
    ...shorthands.padding('24px', '32px'),
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  hivesCount: {
    fontSize: '18px',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  hivesCountLight: {
    color: 'rgba(0, 0, 0, 0.5)',
  },

  // Map area
  mapArea: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  mapAreaLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },

  // Placeholder map
  placeholderMap: {
    width: '95%',
    height: '90%',
    borderRadius: '24px',
    backgroundColor: 'rgba(0, 120, 212, 0.1)',
    border: '2px dashed rgba(0, 120, 212, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  placeholderMapLight: {
    backgroundColor: 'rgba(0, 120, 212, 0.05)',
    border: '2px dashed rgba(0, 120, 212, 0.2)',
  },
  mapGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `
      linear-gradient(rgba(0, 120, 212, 0.1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 120, 212, 0.1) 1px, transparent 1px)
    `,
    backgroundSize: '60px 60px',
    pointerEvents: 'none',
  },
  mapLabel: {
    fontSize: '24px',
    color: 'rgba(255, 255, 255, 0.4)',
    zIndex: 1,
  },
  mapLabelLight: {
    color: 'rgba(0, 0, 0, 0.3)',
  },
  mapIcon: {
    fontSize: '80px',
    marginBottom: '16px',
    opacity: 0.5,
    zIndex: 1,
  },

  // Hive markers positioned randomly on map
  hiveMarkersContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  hiveMarker: {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'auto',
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
    ':hover': {
      transform: 'translate(-50%, -50%) scale(1.15)',
      zIndex: 100,
    },
  },
  markerIcon: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4)',
    border: '4px solid white',
  },
  markerActive: {
    boxShadow: '0 0 0 6px rgba(0, 120, 212, 0.5), 0 6px 20px rgba(0, 0, 0, 0.4)',
    animation: 'pulse 2s ease-in-out infinite',
  },
  markerLabel: {
    marginTop: '8px',
    ...shorthands.padding('6px', '12px'),
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    color: 'white',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  },
  markerLabelLight: {
    backgroundColor: 'white',
    color: '#1a1a1a',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
  },
  markerTemp: {
    fontSize: '12px',
    fontWeight: 500,
    opacity: 0.8,
  },

  // Legend
  legend: {
    position: 'absolute',
    bottom: '24px',
    left: '24px',
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('12px'),
    ...shorthands.padding('20px'),
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(12px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  legendLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    border: '1px solid rgba(0, 0, 0, 0.1)',
  },
  legendTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: 'white',
    marginBottom: '4px',
  },
  legendTitleLight: {
    color: '#1a1a1a',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  legendItemLight: {
    color: 'rgba(0, 0, 0, 0.7)',
  },
  legendDot: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid white',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
  },
  legendDotLight: {
    border: '2px solid #666',
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

interface MapZoneProps {
  currentHiveIndex: number;
  hives: ExtendedHive[];
  onSelectHive: (index: number) => void;
  isDark: boolean;
}

// Generate deterministic positions for hives based on their devEui
function getHivePosition(hive: OverviewHive, index: number, total: number): { x: number; y: number } {
  // Create a simple hash from devEui for deterministic positioning
  const hash = hive.devEui?.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) ?? index * 123;
  
  // Spread hives in a grid-like pattern with some randomization
  const cols = Math.ceil(Math.sqrt(total));
  const row = Math.floor(index / cols);
  const col = index % cols;
  
  // Base position
  const baseX = 15 + (col / cols) * 70;
  const baseY = 15 + (row / Math.ceil(total / cols)) * 70;
  
  // Add hash-based offset
  const offsetX = ((hash % 100) - 50) / 10;
  const offsetY = (((hash * 7) % 100) - 50) / 10;
  
  return {
    x: Math.min(90, Math.max(10, baseX + offsetX)),
    y: Math.min(85, Math.max(15, baseY + offsetY)),
  };
}

export function MapZone({ currentHiveIndex, hives, onSelectHive, isDark }: MapZoneProps) {
  const styles = useStyles();

  const formatTemp = (tempC: number | null): string => {
    if (tempC == null) return '—';
    return `${tempC.toFixed(1)}°C`;
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={mergeClasses(styles.header, !isDark && styles.headerLight)}>
        <span className={mergeClasses(styles.title, !isDark && styles.titleLight)}>
          🗺️ Apiary Map
        </span>
        <span className={mergeClasses(styles.hivesCount, !isDark && styles.hivesCountLight)}>
          {hives.length} hive{hives.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Map Area */}
      <div className={mergeClasses(styles.mapArea, !isDark && styles.mapAreaLight)}>
        <div className={mergeClasses(styles.placeholderMap, !isDark && styles.placeholderMapLight)}>
          <div className={styles.mapGrid} />
          
          {hives.length === 0 ? (
            <>
              <span className={styles.mapIcon}>🗺️</span>
              <span className={mergeClasses(styles.mapLabel, !isDark && styles.mapLabelLight)}>
                No hives to display
              </span>
            </>
          ) : (
            <div className={styles.hiveMarkersContainer}>
              {hives.map((hive, index) => {
                const pos = getHivePosition(hive, index, hives.length);
                const status = getHiveStatusFromTemp(hive.latestTemperature, hive.latestTemperatureF);
                const color = getTemperatureColor(hive.latestTemperature);
                const isActive = index === currentHiveIndex;
                
                return (
                  <div
                    key={hive.devEui || index}
                    className={styles.hiveMarker}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    onClick={() => onSelectHive(index)}
                  >
                    <div 
                      className={mergeClasses(styles.markerIcon, isActive && styles.markerActive)}
                      style={{ backgroundColor: color }}
                    >
                      🐝
                    </div>
                    <div className={mergeClasses(styles.markerLabel, !isDark && styles.markerLabelLight)}>
                      <div>{hive.hiveName || `Hive ${index + 1}`}</div>
                      <div className={styles.markerTemp}>{formatTemp(hive.latestTemperature)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className={mergeClasses(styles.legend, !isDark && styles.legendLight)}>
          <span className={mergeClasses(styles.legendTitle, !isDark && styles.legendTitleLight)}>
            Temperature Status
          </span>
          <div className={mergeClasses(styles.legendItem, !isDark && styles.legendItemLight)}>
            <span 
              className={mergeClasses(styles.legendDot, !isDark && styles.legendDotLight)}
              style={{ backgroundColor: hiveStatusColors.healthy.border }}
            />
            Healthy (34-38°C)
          </div>
          <div className={mergeClasses(styles.legendItem, !isDark && styles.legendItemLight)}>
            <span 
              className={mergeClasses(styles.legendDot, !isDark && styles.legendDotLight)}
              style={{ backgroundColor: hiveStatusColors.warning.border }}
            />
            Warning (30-34°C, 38-42°C)
          </div>
          <div className={mergeClasses(styles.legendItem, !isDark && styles.legendItemLight)}>
            <span 
              className={mergeClasses(styles.legendDot, !isDark && styles.legendDotLight)}
              style={{ backgroundColor: hiveStatusColors.critical.border }}
            />
            Critical (&lt;30°C, &gt;42°C)
          </div>
        </div>
      </div>
    </div>
  );
}
