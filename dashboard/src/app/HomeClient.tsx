'use client';

import { useState, useCallback, useMemo } from 'react';
import { DashboardHeader } from './components/DashboardHeader';
import { OverviewStats } from './components/OverviewStats';
import { HiveDashboard } from './components/HiveDashboard';
import { ArchitectureDiagram } from './components/ArchitectureDiagram';
import { AboutPage } from './components/AboutPage';
import { HiveMap, HiveLocation } from './components/map/HiveMap';
import { Footer } from './components/common/Footer';
import { KioskModeProvider, useKioskMode } from './components/kiosk/KioskModeProvider';
import { UnitPreferencesProvider } from './contexts/UnitPreferencesContext';
import { makeStyles, shorthands, mergeClasses } from '@griffel/react';
import { tokens } from '@fluentui/react-theme';
import { ConnectionState } from './components/common/ConnectionStatus';

const useStyles = makeStyles({
  main: {
    backgroundColor: tokens.colorNeutralBackground2,
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  content: {
    flex: 1,
    maxWidth: '1400px',
    margin: '0 auto',
    width: '100%',
    ...shorthands.padding('24px', '32px'),
    '@media (max-width: 768px)': {
      ...shorthands.padding('16px'),
    },
  },
  fullWidth: {
    maxWidth: 'none',
    ...shorthands.padding('24px', '32px'),
  },
  kioskMode: {
    backgroundColor: tokens.colorNeutralBackground1,
  },
  mapSection: {
    marginBottom: '24px',
  },
  sectionTitle: {
    marginBottom: '16px',
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase500,
  },
});

export type Section = 'dashboard' | 'map' | 'architecture' | 'about';

function HomeContent() {
  const styles = useStyles();
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [connectionState, setConnectionState] = useState<ConnectionState>('polling');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [hiveLocations, setHiveLocations] = useState<HiveLocation[]>([]);
  const [selectedHiveId, setSelectedHiveId] = useState<string | null>(null);
  
  // Try to use kiosk mode, but handle case where provider isn't available
  let kioskMode: ReturnType<typeof useKioskMode> | null = null;
  try {
    kioskMode = useKioskMode();
  } catch {
    // KioskModeProvider not available, that's fine
  }

  const handleKioskToggle = useCallback(() => {
    kioskMode?.toggleKioskMode();
  }, [kioskMode]);

  const handleConnectionStateChange = useCallback((state: ConnectionState, updated?: Date) => {
    setConnectionState(state);
    if (updated) setLastUpdated(updated);
  }, []);

  // Callback to receive hive data from HiveDashboard for the map
  const handleHivesLoaded = useCallback((hives: HiveLocation[]) => {
    setHiveLocations(hives);
  }, []);

  const handleMapHiveSelect = useCallback((hiveId: string) => {
    setSelectedHiveId(hiveId);
    setActiveSection('dashboard');
  }, []);

  // Determine if content should be full-width
  const isFullWidth = activeSection === 'architecture' || activeSection === 'about';

  return (
    <div className={mergeClasses(
      styles.main,
      kioskMode?.isKioskMode && styles.kioskMode
    )}>
      <DashboardHeader 
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        connectionState={connectionState}
        lastUpdated={lastUpdated}
        onKioskToggle={handleKioskToggle}
      />
      
      <div className={mergeClasses(
        styles.content,
        isFullWidth && styles.fullWidth
      )}>
        {activeSection === 'dashboard' && (
          <>
            <OverviewStats />
            <HiveDashboard 
              onConnectionStateChange={handleConnectionStateChange}
              onHivesLoaded={handleHivesLoaded}
              selectedHiveId={selectedHiveId}
              onHiveSelect={setSelectedHiveId}
            />
          </>
        )}
        
        {activeSection === 'map' && (
          <div className={styles.mapSection}>
            <h2 className={styles.sectionTitle}>🗺️ Hive Locations</h2>
            <HiveMap 
              hives={hiveLocations}
              selectedHiveId={selectedHiveId}
              onHiveSelect={handleMapHiveSelect}
              height="600px"
            />
          </div>
        )}
        
        {activeSection === 'architecture' && (
          <ArchitectureDiagram />
        )}
        
        {activeSection === 'about' && (
          <AboutPage />
        )}
      </div>
      
      <Footer />
    </div>
  );
}

export default function HomeClient() {
  return (
    <UnitPreferencesProvider>
      <KioskModeProvider>
        <HomeContent />
      </KioskModeProvider>
    </UnitPreferencesProvider>
  );
}
