'use client';

import { useState, useCallback, useMemo } from 'react';
import { DashboardHeader } from './components/DashboardHeader';
import { OverviewStats } from './components/OverviewStats';
import { HiveDashboard } from './components/HiveDashboard';
import { ArchitectureDiagram } from './components/ArchitectureDiagram';
import { AboutPage } from './components/AboutPage';
import { ApiaryView } from './components/ApiaryView';
import { HiveMap, HiveLocation } from './components/map/HiveMap';
import { Footer } from './components/common/Footer';
import { KioskModeProvider, useKioskMode } from './components/kiosk/KioskModeProvider';
import { UnitPreferencesProvider } from './contexts/UnitPreferencesContext';
import { makeStyles, shorthands, mergeClasses } from '@griffel/react';
import { tokens } from '@fluentui/react-theme';
import { ConnectionState } from './components/common/ConnectionStatus';
import { Title3 } from '@fluentui/react-text';

const useStyles = makeStyles({
  main: {
    backgroundColor: tokens.colorNeutralBackground2,
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  content: {
    flex: 1,
    maxWidth: '1600px',
    margin: '0 auto',
    width: '100%',
    ...shorthands.padding('16px', '24px'),
    '@media (max-width: 768px)': {
      ...shorthands.padding('12px'),
    },
  },
  fullWidth: {
    maxWidth: 'none',
    ...shorthands.padding('16px', '24px'),
  },
  kioskMode: {
    backgroundColor: tokens.colorNeutralBackground1,
  },
  dashboardLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 350px',
    ...shorthands.gap('16px'),
    '@media (max-width: 1200px)': {
      gridTemplateColumns: '1fr',
    },
  },
  mainColumn: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('16px'),
  },
  sideColumn: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('16px'),
    '@media (max-width: 1200px)': {
      display: 'none',
    },
  },
  mapContainer: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    ...shorthands.padding('12px'),
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    boxShadow: tokens.shadow4,
  },
  mapTitle: {
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
  mapIcon: {
    fontSize: '20px',
  },
  sectionTitle: {
    marginBottom: '12px',
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase400,
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
});

export type Section = 'dashboard' | 'apiary' | 'architecture' | 'about';

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
  }, []);

  const handleApiaryHiveSelect = useCallback((hiveId: string) => {
    setSelectedHiveId(hiveId);
    setActiveSection('dashboard');
  }, []);

  // Determine if content should be full-width
  const isFullWidth = activeSection === 'architecture' || activeSection === 'about' || activeSection === 'apiary';

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
          <div className={styles.dashboardLayout}>
            <div className={styles.mainColumn}>
              <OverviewStats />
              <HiveDashboard 
                onConnectionStateChange={handleConnectionStateChange}
                onHivesLoaded={handleHivesLoaded}
                selectedHiveId={selectedHiveId}
                onHiveSelect={setSelectedHiveId}
              />
            </div>
            <div className={styles.sideColumn}>
              <div className={styles.mapContainer}>
                <div className={styles.mapTitle}>
                  <span className={styles.mapIcon}>🗺️</span>
                  <Title3>Hive Locations</Title3>
                </div>
                <HiveMap 
                  hives={hiveLocations}
                  selectedHiveId={selectedHiveId}
                  onHiveSelect={handleMapHiveSelect}
                  height="300px"
                />
              </div>
            </div>
          </div>
        )}
        
        {activeSection === 'apiary' && (
          <ApiaryView onHiveSelect={handleApiaryHiveSelect} />
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
