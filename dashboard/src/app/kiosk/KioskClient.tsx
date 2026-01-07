'use client';

import { useState, useEffect, useCallback, useMemo, TouchEvent } from 'react';
import { makeStyles, shorthands, mergeClasses } from '@griffel/react';
import { tokens } from '@fluentui/react-theme';
import { Text, Title1, Title2, Title3 } from '@fluentui/react-text';
import { Button, ToggleButton } from '@fluentui/react-button';
import { Badge } from '@fluentui/react-badge';
import { Spinner } from '@fluentui/react-spinner';
import { Tooltip } from '@fluentui/react-tooltip';
import { 
  Dismiss24Regular,
  FullScreenMaximize24Regular,
  ArrowLeft24Regular,
  ArrowRight24Regular,
  Pause24Regular,
  Play24Regular,
  WeatherMoon20Regular,
  WeatherSunny20Regular,
  Grid20Regular,
  DataBarVertical20Regular,
  ResizeLarge20Regular,
  ResizeSmall20Regular,
  Home20Regular,
  Info20Regular,
  Organization20Regular,
} from '@fluentui/react-icons';
import { fetchJson, OverviewResponse, OverviewHive } from '../lib/api';
import { UnitPreferencesProvider, useUnitPreferences } from '../contexts/UnitPreferencesContext';
import { celsiusToFahrenheit, milligramsToKg, milligramsToLbs } from '../lib/units';
import { hubColors, getTemperatureColor, getHiveStatusFromTemp, hiveStatusColors } from '../lib/theme';
import { HiveMap, HiveLocation } from '../components/map/HiveMap';
import { useSwipeGesture, useScreenSize } from '../hooks/useSwipeGesture';
import { useThemeMode } from '../providers';

const useStyles = makeStyles({
  container: {
    backgroundColor: '#0a0a0a',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    color: '#ffffff',
    overflow: 'hidden',
    touchAction: 'pan-y', // Enable vertical scroll, detect horizontal swipe
  },
  containerLight: {
    backgroundColor: '#f5f5f5',
    color: '#1a1a1a',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding('16px', '32px'),
    background: `linear-gradient(135deg, ${hubColors.primary} 0%, ${hubColors.primaryDark} 100%)`,
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    flexWrap: 'wrap',
    ...shorthands.gap('12px'),
    '@media (max-width: 768px)': {
      ...shorthands.padding('12px', '16px'),
    },
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('16px'),
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
  },
  msLogo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 12px)',
    gridTemplateRows: 'repeat(2, 12px)',
    ...shorthands.gap('3px'),
  },
  msLogoSquare: {
    width: '12px',
    height: '12px',
  },
  brandText: {
    display: 'flex',
    flexDirection: 'column',
  },
  brandTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#ffffff',
  },
  brandSubtitle: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  brandSubtitleLight: {
    color: 'rgba(0, 0, 0, 0.6)',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
  },
  controlButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    color: '#ffffff',
    ...shorthands.border('none'),
    ...shorthands.borderRadius('8px'),
    minWidth: '44px',
    minHeight: '44px', // Touch-friendly minimum size
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
    '@media (min-width: 1920px)': {
      minWidth: '56px',
      minHeight: '56px',
    },
  },
  exitButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    color: '#ffffff',
    ...shorthands.border('none'),
    ...shorthands.borderRadius('8px'),
    minWidth: '44px',
    minHeight: '44px',
    ':hover': {
      backgroundColor: 'rgba(255, 0, 0, 0.3)',
    },
  },
  // View mode toggle
  viewModeToggle: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    ...shorthands.borderRadius('8px'),
    ...shorthands.padding('4px'),
  },
  viewModeButton: {
    backgroundColor: 'transparent',
    color: 'rgba(255, 255, 255, 0.7)',
    minWidth: '40px',
    minHeight: '40px',
    ...shorthands.border('none'),
    ...shorthands.borderRadius('6px'),
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      color: 'white',
    },
  },
  viewModeButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: 'white',
  },
  // Size selector
  sizeSelector: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
    '@media (max-width: 1200px)': {
      display: 'none',
    },
  },
  sizeLabel: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  sizeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: 'rgba(255, 255, 255, 0.8)',
    minWidth: '36px',
    minHeight: '36px',
    fontSize: '12px',
    fontWeight: 600,
    ...shorthands.border('none'),
    ...shorthands.borderRadius('6px'),
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
  },
  sizeButtonActive: {
    backgroundColor: hubColors.primary,
    color: 'white',
  },
  // Touch navigation overlay
  touchNavArea: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
    transition: 'opacity 0.2s',
    cursor: 'pointer',
    zIndex: 10,
    '@media (hover: hover)': {
      ':hover': {
        opacity: 0.8,
      },
    },
  },
  touchNavLeft: {
    left: 0,
    background: 'linear-gradient(90deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
  },
  touchNavRight: {
    right: 0,
    background: 'linear-gradient(-90deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
  },
  touchNavIcon: {
    fontSize: '48px',
    color: 'white',
  },
  // Swipe indicator
  swipeIndicator: {
    position: 'fixed',
    top: '50%',
    transform: 'translateY(-50%)',
    ...shorthands.padding('16px', '24px'),
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    ...shorthands.borderRadius('12px'),
    color: 'white',
    fontSize: '18px',
    fontWeight: 600,
    zIndex: 100,
    pointerEvents: 'none',
  },
  swipeLeft: {
    right: '20px',
  },
  swipeRight: {
    left: '20px',
  },
  main: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 400px',
    ...shorthands.gap('24px'),
    ...shorthands.padding('24px', '32px'),
    '@media (max-width: 1400px)': {
      gridTemplateColumns: '1fr',
    },
  },
  mainFHD: {
    gridTemplateColumns: '1fr 350px',
    ...shorthands.padding('16px', '24px'),
    ...shorthands.gap('16px'),
  },
  leftPanel: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('24px'),
  },
  leftPanelFHD: {
    ...shorthands.gap('16px'),
  },
  rightPanel: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('24px'),
    '@media (max-width: 1400px)': {
      display: 'none',
    },
  },
  rightPanelFHD: {
    ...shorthands.gap('16px'),
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    ...shorthands.gap('16px'),
  },
  statsGridFHD: {
    ...shorthands.gap('12px'),
  },
  statCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    ...shorthands.borderRadius('16px'),
    ...shorthands.padding('24px'),
    border: '1px solid rgba(255, 255, 255, 0.1)',
    textAlign: 'center',
  },
  statCardLight: {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  statCardFHD: {
    ...shorthands.padding('16px'),
    ...shorthands.borderRadius('12px'),
  },
  statValue: {
    fontSize: '48px',
    fontWeight: '700',
    lineHeight: '1',
    marginBottom: '8px',
  },
  statValueFHD: {
    fontSize: '36px',
    marginBottom: '4px',
  },
  statLabel: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  statLabelLight: {
    color: 'rgba(0, 0, 0, 0.6)',
  },
  statLabelFHD: {
    fontSize: '12px',
  },
  hiveSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    ...shorthands.borderRadius('16px'),
    ...shorthands.padding('24px'),
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  hiveSectionLight: {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  hiveSectionFHD: {
    ...shorthands.padding('16px'),
    ...shorthands.borderRadius('12px'),
  },
  hiveHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  hiveHeaderFHD: {
    marginBottom: '16px',
  },
  hiveName: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#ffffff',
  },
  hiveNameLight: {
    color: '#1a1a1a',
  },
  hiveNameFHD: {
    fontSize: '24px',
  },
  hiveNavigation: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
  navButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#ffffff',
    width: '40px',
    height: '40px',
    minWidth: '40px',
    ...shorthands.border('none'),
    ...shorthands.borderRadius('50%'),
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    ':disabled': {
      opacity: '0.3',
    },
  },
  hiveIndicator: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.6)',
    ...shorthands.padding('0', '12px'),
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    ...shorthands.gap('16px'),
    flex: 1,
  },
  metricsGridFHD: {
    ...shorthands.gap('12px'),
  },
  metricCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    ...shorthands.borderRadius('12px'),
    ...shorthands.padding('20px'),
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
  },
  metricCardFHD: {
    ...shorthands.padding('12px'),
    ...shorthands.borderRadius('8px'),
  },
  metricIcon: {
    fontSize: '32px',
    marginBottom: '12px',
  },
  metricIconFHD: {
    fontSize: '24px',
    marginBottom: '8px',
  },
  metricValue: {
    fontSize: '36px',
    fontWeight: '700',
    lineHeight: '1',
  },
  metricValueFHD: {
    fontSize: '28px',
  },
  metricLabel: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  metricLabelFHD: {
    fontSize: '10px',
    marginTop: '4px',
  },
  mapCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    ...shorthands.borderRadius('16px'),
    ...shorthands.padding('16px'),
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  mapCardFHD: {
    ...shorthands.padding('12px'),
    ...shorthands.borderRadius('12px'),
  },
  mapTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
  mapTitleFHD: {
    fontSize: '14px',
    marginBottom: '8px',
  },
  heatmapCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    ...shorthands.borderRadius('16px'),
    ...shorthands.padding('16px'),
    border: '1px solid rgba(255, 255, 255, 0.1)',
    flex: 1,
  },
  heatmapCardFHD: {
    ...shorthands.padding('12px'),
    ...shorthands.borderRadius('12px'),
  },
  heatmapTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
  heatmapTitleFHD: {
    fontSize: '14px',
    marginBottom: '12px',
  },
  heatmapGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(24, 1fr)',
    ...shorthands.gap('2px'),
  },
  heatmapCell: {
    aspectRatio: '1',
    ...shorthands.borderRadius('2px'),
    transition: 'transform 0.1s',
    ':hover': {
      transform: 'scale(1.5)',
      zIndex: '10',
    },
  },
  heatmapLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '8px',
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  heatmapLegend: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '12px',
    ...shorthands.gap('8px'),
  },
  legendGradient: {
    width: '120px',
    height: '12px',
    ...shorthands.borderRadius('6px'),
    background: 'linear-gradient(90deg, #3b82f6 0%, #22c55e 25%, #eab308 50%, #f97316 75%, #ef4444 100%)',
  },
  legendLabel: {
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  loadingContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    marginLeft: '12px',
  },
  footer: {
    ...shorthands.padding('12px', '32px'),
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  footerFHD: {
    ...shorthands.padding('8px', '24px'),
    fontSize: '10px',
  },
  clock: {
    fontFamily: 'monospace',
    fontSize: '16px',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  clockFHD: {
    fontSize: '14px',
  },
});

type ExtendedHive = OverviewHive & {
  latestTemperature: number | null;
  latestTemperatureF: number | null;
  latestWeight: number | null;
  latestHumidity: number | null;
  latestBattery: number | null;
  latestSoundLevel: number | null;
  latestTimestamp: string | null;
};

function KioskContent() {
  const styles = useStyles();
  const { temperatureUnit, weightUnit } = useUnitPreferences();
  const { isDark, setMode } = useThemeMode();
  const screenSize = useScreenSize();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentHiveIndex, setCurrentHiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFHD, setIsFHD] = useState(false);
  const [viewMode, setViewMode] = useState<'heroes' | 'charts'>('heroes');
  const [tileSize, setTileSize] = useState<'small' | 'medium' | 'large' | 'xlarge'>('medium');
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  // Toggle theme helper
  const toggleTheme = () => setMode(isDark ? 'light' : 'dark');

  // Check screen resolution
  useEffect(() => {
    const checkResolution = () => {
      setIsFHD(window.innerHeight <= 1080);
    };
    checkResolution();
    window.addEventListener('resize', checkResolution);
    return () => window.removeEventListener('resize', checkResolution);
  }, []);

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
    }, 10000);
    return () => clearInterval(timer);
  }, [isPaused, data?.hives.length]);

  // Swipe gesture navigation
  const navigatePrev = () => {
    if (hives.length > 0) {
      setCurrentHiveIndex(prev => (prev - 1 + hives.length) % hives.length);
      setSwipeDirection('right');
      setTimeout(() => setSwipeDirection(null), 500);
    }
  };

  const navigateNext = () => {
    if (hives.length > 0) {
      setCurrentHiveIndex(prev => (prev + 1) % hives.length);
      setSwipeDirection('left');
      setTimeout(() => setSwipeDirection(null), 500);
    }
  };

  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: navigateNext,
    onSwipeRight: navigatePrev,
  }, { threshold: 50 });

  // Toggle view mode
  const toggleViewMode = () => setViewMode(prev => prev === 'heroes' ? 'charts' : 'heroes');

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

  const hiveLocations: HiveLocation[] = useMemo(() => {
    return hives.map(h => ({
      id: h.hiveIdentity || h.devEui,
      name: h.hiveName,
      latitude: h.location?.latitude || 40.7128,
      longitude: h.location?.longitude || -74.006,
      isOnline: true,
    }));
  }, [hives]);

  // Use native Fahrenheit from database when available, fallback to conversion
  const formatTemp = (tempC: number | null | undefined, tempF?: number | null | undefined): string => {
    if (temperatureUnit === 'fahrenheit') {
      if (tempF != null) {
        return `${tempF.toFixed(0)}°F`;
      }
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

  const goToPrev = () => {
    setCurrentHiveIndex(prev => (prev - 1 + hives.length) % hives.length);
  };

  const goToNext = () => {
    setCurrentHiveIndex(prev => (prev + 1) % hives.length);
  };

  // Generate mock heatmap data for 24 hours x 7 days
  const heatmapData = useMemo(() => {
    const data: number[][] = [];
    for (let day = 0; day < 7; day++) {
      const row: number[] = [];
      for (let hour = 0; hour < 24; hour++) {
        // Simulate temperature pattern: warmer during day, cooler at night
        const baseTemp = 32 + Math.random() * 4;
        const hourFactor = Math.sin((hour - 6) * Math.PI / 12) * 3;
        row.push(baseTemp + hourFactor + Math.random() * 2);
      }
      data.push(row);
    }
    return data;
  }, []);

  const getHeatmapColor = (temp: number): string => {
    if (temp < 30) return '#3b82f6'; // blue - cold
    if (temp < 33) return '#22c55e'; // green - cool
    if (temp < 35) return '#eab308'; // yellow - optimal
    if (temp < 37) return '#f97316'; // orange - warm
    return '#ef4444'; // red - hot
  };

  const getStatus = () => {
    if (!currentHive) return { color: 'informative' as const, label: 'No Data' };
    const status = getHiveStatusFromTemp(currentHive.latestTemperature, currentHive.latestTemperatureF);
    const config = {
      healthy: { color: 'success' as const, label: 'Healthy' },
      warning: { color: 'warning' as const, label: 'Warning' },
      critical: { color: 'danger' as const, label: 'Critical' },
      unknown: { color: 'informative' as const, label: 'No Data' },
    };
    return config[status];
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <Spinner size="huge" label="Loading Kiosk Mode..." />
        </div>
      </div>
    );
  }

  const status = getStatus();

  return (
    <div 
      className={mergeClasses(styles.container, !isDark && styles.containerLight)}
      {...swipeHandlers}
    >
      {/* Swipe indicator */}
      {swipeDirection && (
        <div className={mergeClasses(
          styles.swipeIndicator,
          swipeDirection === 'left' ? styles.swipeLeft : styles.swipeRight
        )}>
          {swipeDirection === 'left' ? '→ Next Hive' : '← Previous Hive'}
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
              <span className={styles.brandSubtitle}>🐝 Beehive Monitor - NYC</span>
            </div>
          </div>
        </div>
        <div className={styles.controls}>
          {/* Theme Toggle */}
          <Tooltip content={isDark ? 'Switch to light mode' : 'Switch to dark mode'} relationship="label">
            <Button
              className={styles.controlButton}
              icon={isDark ? <WeatherSunny20Regular /> : <WeatherMoon20Regular />}
              onClick={toggleTheme}
            />
          </Tooltip>
          {/* View Mode Toggle */}
          <div className={styles.viewModeToggle}>
            <Tooltip content="Hero cards view" relationship="label">
              <Button
                className={mergeClasses(styles.viewModeButton, viewMode === 'heroes' && styles.sizeButtonActive)}
                icon={<Grid20Regular />}
                onClick={() => setViewMode('heroes')}
              />
            </Tooltip>
            <Tooltip content="Charts view" relationship="label">
              <Button
                className={mergeClasses(styles.viewModeButton, viewMode === 'charts' && styles.sizeButtonActive)}
                icon={<DataBarVertical20Regular />}
                onClick={() => setViewMode('charts')}
              />
            </Tooltip>
          </div>
          {/* Size Selector */}
          <div className={styles.sizeSelector}>
            <span className={styles.sizeLabel}>Size:</span>
            {(['small', 'medium', 'large', 'xlarge'] as const).map(size => (
              <Button
                key={size}
                className={mergeClasses(styles.sizeButton, tileSize === size && styles.sizeButtonActive)}
                onClick={() => setTileSize(size)}
              >
                {size[0].toUpperCase()}
              </Button>
            ))}
          </div>
          <Button
            className={styles.controlButton}
            icon={isPaused ? <Play24Regular /> : <Pause24Regular />}
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? 'Resume auto-cycle' : 'Pause auto-cycle'}
          />
          <Button
            className={styles.controlButton}
            icon={<FullScreenMaximize24Regular />}
            onClick={toggleFullscreen}
            title="Toggle fullscreen"
          />
          <Button
            className={styles.exitButton}
            icon={<Dismiss24Regular />}
            onClick={() => window.location.href = '/'}
            title="Exit kiosk mode"
          />
        </div>
      </header>

      {/* Main Content */}
      <main className={mergeClasses(styles.main, isFHD && styles.mainFHD)}>
        {/* Left Panel */}
        <div className={mergeClasses(styles.leftPanel, isFHD && styles.leftPanelFHD)}>
          {/* Stats Row */}
          <div className={mergeClasses(styles.statsGrid, isFHD && styles.statsGridFHD)}>
            <div className={mergeClasses(styles.statCard, isFHD && styles.statCardFHD, !isDark && styles.statCardLight)}>
              <div className={mergeClasses(styles.statValue, isFHD && styles.statValueFHD)} style={{ color: hubColors.primary }}>
                {data?.activeDevices ?? 0}
              </div>
              <div className={mergeClasses(styles.statLabel, isFHD && styles.statLabelFHD, !isDark && styles.statLabelLight)}>Active Hives</div>
            </div>
            <div className={mergeClasses(styles.statCard, isFHD && styles.statCardFHD, !isDark && styles.statCardLight)}>
              <div className={mergeClasses(styles.statValue, isFHD && styles.statValueFHD)} style={{ color: '#22c55e' }}>
                {data?.gatewaysOnline ?? 0}
              </div>
              <div className={mergeClasses(styles.statLabel, isFHD && styles.statLabelFHD, !isDark && styles.statLabelLight)}>Gateways Online</div>
            </div>
            <div className={mergeClasses(styles.statCard, isFHD && styles.statCardFHD, !isDark && styles.statCardLight)}>
              <div className={mergeClasses(styles.statValue, isFHD && styles.statValueFHD)} style={{ color: '#a855f7' }}>
                {data?.messagesToday ?? 0}
              </div>
              <div className={mergeClasses(styles.statLabel, isFHD && styles.statLabelFHD, !isDark && styles.statLabelLight)}>Messages Today</div>
            </div>
            <div className={mergeClasses(styles.statCard, isFHD && styles.statCardFHD, !isDark && styles.statCardLight)}>
              <div className={mergeClasses(styles.statValue, isFHD && styles.statValueFHD)} style={{ color: '#f59e0b' }}>
                {hives.length}
              </div>
              <div className={mergeClasses(styles.statLabel, isFHD && styles.statLabelFHD, !isDark && styles.statLabelLight)}>Total Hives</div>
            </div>
          </div>

          {/* Hive Detail Section */}
          <div className={mergeClasses(styles.hiveSection, isFHD && styles.hiveSectionFHD, !isDark && styles.hiveSectionLight)}>
            <div className={mergeClasses(styles.hiveHeader, isFHD && styles.hiveHeaderFHD)}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className={mergeClasses(styles.hiveName, isFHD && styles.hiveNameFHD, !isDark && styles.hiveNameLight)}>
                  🏠 {currentHive?.hiveName || `Hive ${currentHiveIndex + 1}`}
                </span>
                <Badge color={status.color} className={styles.statusBadge}>
                  {status.label}
                </Badge>
              </div>
              <div className={styles.hiveNavigation}>
                <Button
                  className={styles.navButton}
                  icon={<ArrowLeft24Regular />}
                  onClick={goToPrev}
                  disabled={hives.length <= 1}
                />
                <span className={styles.hiveIndicator}>
                  {currentHiveIndex + 1} / {hives.length}
                </span>
                <Button
                  className={styles.navButton}
                  icon={<ArrowRight24Regular />}
                  onClick={goToNext}
                  disabled={hives.length <= 1}
                />
              </div>
            </div>

            <div className={mergeClasses(styles.metricsGrid, isFHD && styles.metricsGridFHD)}>
              <div className={mergeClasses(styles.metricCard, isFHD && styles.metricCardFHD)}>
                <span className={mergeClasses(styles.metricIcon, isFHD && styles.metricIconFHD)}>🌡️</span>
                <span 
                  className={mergeClasses(styles.metricValue, isFHD && styles.metricValueFHD)}
                  style={{ color: currentHive?.latestTemperature ? getTemperatureColor(currentHive.latestTemperature) : '#888' }}
                >
                  {formatTemp(currentHive?.latestTemperature, currentHive?.latestTemperatureF)}
                </span>
                <span className={mergeClasses(styles.metricLabel, isFHD && styles.metricLabelFHD)}>Temperature</span>
              </div>
              <div className={mergeClasses(styles.metricCard, isFHD && styles.metricCardFHD)}>
                <span className={mergeClasses(styles.metricIcon, isFHD && styles.metricIconFHD)}>⚖️</span>
                <span className={mergeClasses(styles.metricValue, isFHD && styles.metricValueFHD)} style={{ color: '#22c55e' }}>
                  {formatWeight(currentHive?.latestWeight)}
                </span>
                <span className={mergeClasses(styles.metricLabel, isFHD && styles.metricLabelFHD)}>Weight</span>
              </div>
              <div className={mergeClasses(styles.metricCard, isFHD && styles.metricCardFHD)}>
                <span className={mergeClasses(styles.metricIcon, isFHD && styles.metricIconFHD)}>💧</span>
                <span className={mergeClasses(styles.metricValue, isFHD && styles.metricValueFHD)} style={{ color: '#3b82f6' }}>
                  {currentHive?.latestHumidity != null ? `${currentHive.latestHumidity.toFixed(0)}%` : '—'}
                </span>
                <span className={mergeClasses(styles.metricLabel, isFHD && styles.metricLabelFHD)}>Humidity</span>
              </div>
              <div className={mergeClasses(styles.metricCard, isFHD && styles.metricCardFHD)}>
                <span className={mergeClasses(styles.metricIcon, isFHD && styles.metricIconFHD)}>🔋</span>
                <span className={mergeClasses(styles.metricValue, isFHD && styles.metricValueFHD)} style={{ color: '#f59e0b' }}>
                  {currentHive?.latestBattery != null ? `${currentHive.latestBattery.toFixed(0)}%` : '—'}
                </span>
                <span className={mergeClasses(styles.metricLabel, isFHD && styles.metricLabelFHD)}>Battery</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className={mergeClasses(styles.rightPanel, isFHD && styles.rightPanelFHD)}>
          {/* Map */}
          <div className={mergeClasses(styles.mapCard, isFHD && styles.mapCardFHD)}>
            <div className={mergeClasses(styles.mapTitle, isFHD && styles.mapTitleFHD)}>
              <span>🗺️</span> Hive Locations
            </div>
            <HiveMap 
              hives={hiveLocations}
              selectedHiveId={currentHive?.hiveIdentity || null}
              onHiveSelect={(id) => {
                const idx = hives.findIndex(h => h.hiveIdentity === id);
                if (idx >= 0) setCurrentHiveIndex(idx);
              }}
              height={isFHD ? "180px" : "220px"}
            />
          </div>

          {/* Temperature Heatmap */}
          <div className={mergeClasses(styles.heatmapCard, isFHD && styles.heatmapCardFHD)}>
            <div className={mergeClasses(styles.heatmapTitle, isFHD && styles.heatmapTitleFHD)}>
              <span>📊</span> Temperature History (7 Days)
            </div>
            <div className={styles.heatmapGrid}>
              {heatmapData.flat().map((temp, i) => (
                <div
                  key={i}
                  className={styles.heatmapCell}
                  style={{ backgroundColor: getHeatmapColor(temp) }}
                  title={`${temp.toFixed(1)}°C`}
                />
              ))}
            </div>
            <div className={styles.heatmapLabels}>
              <span>12am</span>
              <span>6am</span>
              <span>12pm</span>
              <span>6pm</span>
              <span>12am</span>
            </div>
            <div className={styles.heatmapLegend}>
              <span className={styles.legendLabel}>Cold</span>
              <div className={styles.legendGradient} />
              <span className={styles.legendLabel}>Hot</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={mergeClasses(styles.footer, isFHD && styles.footerFHD)}>
        <span>Microsoft Innovation Hub • NYC Beehive Monitoring System</span>
        <span className={mergeClasses(styles.clock, isFHD && styles.clockFHD)}>
          {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <span>Auto-refresh: 30s • {isPaused ? 'Paused' : 'Auto-cycling'}</span>
      </footer>
    </div>
  );
}

export default function KioskClient() {
  return (
    <UnitPreferencesProvider>
      <KioskContent />
    </UnitPreferencesProvider>
  );
}
