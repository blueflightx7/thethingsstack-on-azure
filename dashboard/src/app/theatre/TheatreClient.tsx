'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { makeStyles, shorthands, mergeClasses } from '@griffel/react';
import { tokens } from '@fluentui/react-theme';
import { Text, Title1, Title2, Title3 } from '@fluentui/react-text';
import { Button } from '@fluentui/react-button';
import { Badge } from '@fluentui/react-badge';
import { Spinner } from '@fluentui/react-spinner';
import { Tooltip } from '@fluentui/react-tooltip';
import {
  Dismiss24Regular,
  FullScreenMaximize24Regular,
  Pause24Regular,
  Play24Regular,
  WeatherMoon24Regular,
  WeatherSunny24Regular,
  Settings24Regular,
  Live24Regular,
  ArrowLeft24Regular,
  ArrowRight24Regular,
} from '@fluentui/react-icons';
import { fetchJson, OverviewResponse, OverviewHive } from '../lib/api';
import { UnitPreferencesProvider, useUnitPreferences } from '../contexts/UnitPreferencesContext';
import { celsiusToFahrenheit, milligramsToKg, milligramsToLbs } from '../lib/units';
import { hubColors, getTemperatureColor, getHiveStatusFromTemp, hiveStatusColors } from '../lib/theme';
import { useScreenInfo, ScreenSize } from '../hooks/useSwipeGesture';
import { useThemeMode } from '../providers';

// Import zone components
import { BroadcastZone } from './zones/BroadcastZone';
import { MapZone } from './zones/MapZone';
import { ChartsZone } from './zones/ChartsZone';
import { MediaZone } from './zones/MediaZone';

// Microsoft Brand Colors
const brandColors = {
  primary: '#0078D4',       // Microsoft Blue
  primaryDark: '#004578',
  primaryLight: '#50E6FF',
  surface: '#1a1a1a',
  surfaceLight: '#ffffff',
  onSurface: '#ffffff',
  onSurfaceLight: '#1a1a1a',
  gradient: 'linear-gradient(135deg, #0078D4 0%, #004578 100%)',
  // Status colors
  success: '#107C10',
  warning: '#FFB900',
  critical: '#D13438',
};

const useStyles = makeStyles({
  // Base container
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: brandColors.surface,
    color: brandColors.onSurface,
    fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
    overflow: 'hidden',
  },
  containerLight: {
    backgroundColor: '#f5f5f5',
    color: brandColors.onSurfaceLight,
  },

  // Header
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding('16px', '32px'),
    background: brandColors.gradient,
    color: 'white',
    minHeight: '72px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    zIndex: 100,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('24px'),
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('16px'),
  },
  msLogo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 16px)',
    gridTemplateRows: 'repeat(2, 16px)',
    ...shorthands.gap('4px'),
  },
  msLogoSquare: {
    width: '16px',
    height: '16px',
  },
  brandText: {
    display: 'flex',
    flexDirection: 'column',
  },
  brandTitle: {
    fontSize: '28px',
    fontWeight: 600,
    color: 'white',
    letterSpacing: '-0.02em',
  },
  brandSubtitle: {
    fontSize: '16px',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  headerCenter: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('24px'),
  },
  clock: {
    fontSize: '32px',
    fontWeight: 300,
    letterSpacing: '2px',
    fontVariantNumeric: 'tabular-nums',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('16px'),
  },
  controlButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    color: 'white',
    minWidth: '52px',
    minHeight: '52px',
    ...shorthands.borderRadius('8px'),
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
  },
  exitButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: 'white',
    minWidth: '52px',
    minHeight: '52px',
    ...shorthands.borderRadius('8px'),
    ':hover': {
      backgroundColor: 'rgba(255, 0, 0, 0.3)',
    },
  },

  // Mode selector
  modeSelector: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    ...shorthands.padding('4px'),
    ...shorthands.borderRadius('8px'),
  },
  modeButton: {
    backgroundColor: 'transparent',
    color: 'rgba(255, 255, 255, 0.7)',
    minWidth: 'auto',
    ...shorthands.padding('8px', '16px'),
    fontSize: '14px',
    fontWeight: 500,
    ...shorthands.borderRadius('6px'),
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
  },
  modeButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: 'white',
  },

  // Main content - zone layouts
  main: {
    flex: 1,
    display: 'grid',
    ...shorthands.gap('0'),
    overflow: 'hidden',
  },

  // 2 Vignette (32:9) - 2 columns
  main2v: {
    gridTemplateColumns: '1fr 1fr',
  },

  // 3 Vignette (48:9) - 3 columns
  main3v: {
    gridTemplateColumns: '1fr 1fr 1fr',
  },

  // Fallback preview mode (16:9) - show split view
  mainPreview: {
    gridTemplateColumns: '1fr 1fr',
    ...shorthands.gap('4px'),
    ...shorthands.padding('4px'),
    backgroundColor: '#333',
  },

  // Zone base styles
  zone: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    overflow: 'hidden',
    position: 'relative',
  },
  zoneLight: {
    backgroundColor: 'white',
  },
  zoneBroadcast: {
    borderLeft: '4px solid transparent',
    borderRight: '4px solid transparent',
    borderImage: `linear-gradient(180deg, ${brandColors.primary}, ${brandColors.primaryDark}) 1`,
  },

  // Live badge
  liveBadge: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
    backgroundColor: 'rgba(209, 52, 56, 0.9)',
    color: 'white',
    ...shorthands.padding('8px', '16px'),
    ...shorthands.borderRadius('24px'),
    fontSize: '14px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    animation: 'pulse 2s ease-in-out infinite',
    zIndex: 10,
    '@keyframes pulse': {
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0.7 },
    },
  },
  liveIcon: {
    animation: 'blink 1s ease-in-out infinite',
    '@keyframes blink': {
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0.3 },
    },
  },

  // Preview mode indicator
  previewBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: brandColors.warning,
    color: '#1a1a1a',
    ...shorthands.padding('12px', '24px'),
    textAlign: 'center',
    fontSize: '16px',
    fontWeight: 600,
    zIndex: 200,
  },

  // Zone headers
  zoneHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding('24px', '32px'),
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  zoneHeaderLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
  },
  zoneTitle: {
    fontSize: '32px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('16px'),
  },
  zoneContent: {
    flex: 1,
    ...shorthands.padding('24px', '32px'),
    overflow: 'auto',
  },

  // Loading state
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    flexDirection: 'column',
    ...shorthands.gap('24px'),
  },

  // Screen info badge
  screenInfo: {
    position: 'fixed',
    bottom: '16px',
    left: '16px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    ...shorthands.padding('8px', '16px'),
    ...shorthands.borderRadius('8px'),
    fontSize: '12px',
    fontFamily: 'monospace',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('4px'),
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

type AspectMode = 'auto' | '32:9' | '48:9';

function TheatreContent() {
  const styles = useStyles();
  const { temperatureUnit, weightUnit } = useUnitPreferences();
  const { isDark, setMode } = useThemeMode();
  const screenInfo = useScreenInfo();
  
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentHiveIndex, setCurrentHiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [aspectMode, setAspectMode] = useState<AspectMode>('auto');
  const [showScreenInfo, setShowScreenInfo] = useState(true);

  // Toggle theme
  const toggleTheme = () => setMode(isDark ? 'light' : 'dark');

  // Determine effective layout based on aspect mode and screen detection
  const effectiveLayout = useMemo(() => {
    if (aspectMode === '32:9') return 'theatre-2v';
    if (aspectMode === '48:9') return 'theatre-3v';
    
    // Auto mode - use detected screen size
    if (screenInfo.size === 'theatre-3v') return 'theatre-3v';
    if (screenInfo.size === 'theatre-2v') return 'theatre-2v';
    
    // Fallback: preview mode for non-ultrawide displays
    return 'preview';
  }, [aspectMode, screenInfo.size]);

  const isPreviewMode = effectiveLayout === 'preview';

  // Clock update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch data
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
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Auto-cycle hives
  useEffect(() => {
    if (isPaused || !data?.hives.length) return;
    const timer = setInterval(() => {
      setCurrentHiveIndex(prev => (prev + 1) % data.hives.length);
    }, 15000); // Slower for theatre - 15 seconds
    return () => clearInterval(timer);
  }, [isPaused, data?.hives.length]);

  const hives = useMemo((): ExtendedHive[] => {
    if (!data?.hives) return [];
    return data.hives
      .filter(h => h.hiveIdentity)
      .map(h => ({
        ...h,
        latestTemperature: h.telemetry?.temperatureInner ?? null,
        latestTemperatureF: h.telemetry?.temperatureInnerF ?? null,
        latestWeight: h.telemetry?.weightKg ? h.telemetry.weightKg * 1000000 : null,
        latestHumidity: h.telemetry?.humidity ?? null,
        latestBattery: h.telemetry?.batteryPercent ?? null,
        latestSoundLevel: h.telemetry?.soundEnergyTotal ?? null,
        latestTimestamp: h.lastMeasurementAt ?? h.lastSeenAt ?? null,
      }));
  }, [data]);

  const currentHive = hives[currentHiveIndex];

  // Navigation
  const goToPrev = () => {
    setCurrentHiveIndex(prev => (prev - 1 + hives.length) % hives.length);
  };
  const goToNext = () => {
    setCurrentHiveIndex(prev => (prev + 1) % hives.length);
  };

  // Fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('Fullscreen error:', err);
    }
  }, []);

  // Format time for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  if (loading) {
    return (
      <div className={mergeClasses(styles.container, !isDark && styles.containerLight)}>
        <div className={styles.loadingContainer}>
          <Spinner size="huge" label="Loading Theatre Mode..." />
        </div>
      </div>
    );
  }

  // Get main layout class
  const getMainClass = () => {
    switch (effectiveLayout) {
      case 'theatre-3v': return styles.main3v;
      case 'theatre-2v': return styles.main2v;
      default: return styles.mainPreview;
    }
  };

  return (
    <div className={mergeClasses(styles.container, !isDark && styles.containerLight)}>
      {/* Preview mode banner */}
      {isPreviewMode && (
        <div className={styles.previewBanner}>
          📺 Preview Mode — Connect to 32:9 or 48:9 LED wall for optimal theatre experience
        </div>
      )}

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>
            <div className={styles.msLogo}>
              <div className={styles.msLogoSquare} style={{ backgroundColor: '#f25022' }} />
              <div className={styles.msLogoSquare} style={{ backgroundColor: '#7fba00' }} />
              <div className={styles.msLogoSquare} style={{ backgroundColor: '#00a4ef' }} />
              <div className={styles.msLogoSquare} style={{ backgroundColor: '#ffb900' }} />
            </div>
            <div className={styles.brandText}>
              <span className={styles.brandTitle}>Microsoft Innovation Hub</span>
              <span className={styles.brandSubtitle}>🐝 Beehive Monitoring — NYC</span>
            </div>
          </div>
        </div>

        <div className={styles.headerCenter}>
          {/* Aspect Mode Selector */}
          <div className={styles.modeSelector}>
            <Button
              className={mergeClasses(styles.modeButton, aspectMode === 'auto' && styles.modeButtonActive)}
              onClick={() => setAspectMode('auto')}
            >
              Auto
            </Button>
            <Button
              className={mergeClasses(styles.modeButton, aspectMode === '32:9' && styles.modeButtonActive)}
              onClick={() => setAspectMode('32:9')}
            >
              32:9
            </Button>
            <Button
              className={mergeClasses(styles.modeButton, aspectMode === '48:9' && styles.modeButtonActive)}
              onClick={() => setAspectMode('48:9')}
            >
              48:9
            </Button>
          </div>
          
          <span className={styles.clock}>{formatTime(currentTime)}</span>
        </div>

        <div className={styles.headerRight}>
          <Tooltip content={isDark ? 'Light mode' : 'Dark mode'} relationship="label">
            <Button
              className={styles.controlButton}
              icon={isDark ? <WeatherSunny24Regular /> : <WeatherMoon24Regular />}
              onClick={toggleTheme}
            />
          </Tooltip>
          <Tooltip content={isPaused ? 'Resume' : 'Pause'} relationship="label">
            <Button
              className={styles.controlButton}
              icon={isPaused ? <Play24Regular /> : <Pause24Regular />}
              onClick={() => setIsPaused(!isPaused)}
            />
          </Tooltip>
          <Tooltip content="Fullscreen" relationship="label">
            <Button
              className={styles.controlButton}
              icon={<FullScreenMaximize24Regular />}
              onClick={toggleFullscreen}
            />
          </Tooltip>
          <Tooltip content="Exit theatre mode" relationship="label">
            <Button
              className={styles.exitButton}
              icon={<Dismiss24Regular />}
              onClick={() => window.location.href = '/'}
            />
          </Tooltip>
        </div>
      </header>

      {/* Main Content - Zone Layout */}
      <main className={mergeClasses(styles.main, getMainClass())}>
        {effectiveLayout === 'theatre-3v' ? (
          // 3 Vignette (48:9): Left | Center (Broadcast) | Right
          <>
            <div className={mergeClasses(styles.zone, !isDark && styles.zoneLight)}>
              <MapZone 
                hives={hives} 
                currentHiveIndex={currentHiveIndex}
                onSelectHive={(index: number) => setCurrentHiveIndex(index)}
                isDark={isDark}
              />
            </div>
            <div className={mergeClasses(styles.zone, styles.zoneBroadcast, !isDark && styles.zoneLight)}>
              <div className={styles.liveBadge}>
                <Live24Regular className={styles.liveIcon} />
                LIVE
              </div>
              <BroadcastZone 
                hive={currentHive}
                hiveIndex={currentHiveIndex}
                totalHives={hives.length}
                data={data}
                onPrev={goToPrev}
                onNext={goToNext}
                isPaused={isPaused}
                isDark={isDark}
              />
            </div>
            <div className={mergeClasses(styles.zone, !isDark && styles.zoneLight)}>
              <ChartsZone 
                hives={hives}
                isDark={isDark}
              />
            </div>
          </>
        ) : effectiveLayout === 'theatre-2v' ? (
          // 2 Vignette (32:9): Left | Right (Broadcast)
          <>
            <div className={mergeClasses(styles.zone, !isDark && styles.zoneLight)}>
              <MapZone 
                hives={hives} 
                currentHiveIndex={currentHiveIndex}
                onSelectHive={(index: number) => setCurrentHiveIndex(index)}
                isDark={isDark}
              />
            </div>
            <div className={mergeClasses(styles.zone, styles.zoneBroadcast, !isDark && styles.zoneLight)}>
              <div className={styles.liveBadge}>
                <Live24Regular className={styles.liveIcon} />
                LIVE
              </div>
              <BroadcastZone 
                hive={currentHive}
                hiveIndex={currentHiveIndex}
                totalHives={hives.length}
                data={data}
                onPrev={goToPrev}
                onNext={goToNext}
                isPaused={isPaused}
                isDark={isDark}
              />
            </div>
          </>
        ) : (
          // Preview mode (16:9): Show both zones side by side
          <>
            <div className={mergeClasses(styles.zone, !isDark && styles.zoneLight)}>
              <MapZone 
                hives={hives} 
                currentHiveIndex={currentHiveIndex}
                onSelectHive={(index: number) => setCurrentHiveIndex(index)}
                isDark={isDark}
              />
            </div>
            <div className={mergeClasses(styles.zone, styles.zoneBroadcast, !isDark && styles.zoneLight)}>
              <div className={styles.liveBadge}>
                <Live24Regular className={styles.liveIcon} />
                PREVIEW
              </div>
              <BroadcastZone 
                hive={currentHive}
                hiveIndex={currentHiveIndex}
                totalHives={hives.length}
                data={data}
                onPrev={goToPrev}
                onNext={goToNext}
                isPaused={isPaused}
                isDark={isDark}
              />
            </div>
          </>
        )}
      </main>

      {/* Screen Info Debug Panel */}
      {showScreenInfo && (
        <div 
          className={styles.screenInfo}
          onClick={() => setShowScreenInfo(false)}
          style={{ cursor: 'pointer' }}
        >
          <span>Mode: {effectiveLayout}</span>
          <span>Screen: {screenInfo.width}×{screenInfo.height}</span>
          <span>Ratio: {screenInfo.aspectRatio.toFixed(2)}</span>
          <span style={{ fontSize: '10px', opacity: 0.6 }}>Click to hide</span>
        </div>
      )}
    </div>
  );
}

export default function TheatreClient() {
  return (
    <UnitPreferencesProvider>
      <TheatreContent />
    </UnitPreferencesProvider>
  );
}
