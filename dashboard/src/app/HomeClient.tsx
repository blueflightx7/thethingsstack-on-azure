'use client';

import { useState, useCallback } from 'react';
import { DashboardHeader } from './components/DashboardHeader';
import { OverviewStats } from './components/OverviewStats';
import { HiveDashboard } from './components/HiveDashboard';
import { ArchitectureDiagram } from './components/ArchitectureDiagram';
import { Footer } from './components/common/Footer';
import { KioskModeProvider, useKioskMode } from './components/kiosk/KioskModeProvider';
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
    ...shorthands.padding('0'),
  },
  kioskMode: {
    backgroundColor: tokens.colorNeutralBackground1,
  },
});

type Section = 'home' | 'architecture';

function HomeContent() {
  const styles = useStyles();
  const [activeSection, setActiveSection] = useState<Section>('home');
  const [connectionState, setConnectionState] = useState<ConnectionState>('polling');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  
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
        activeSection === 'architecture' && styles.fullWidth
      )}>
        {activeSection === 'home' ? (
          <>
            <OverviewStats />
            <HiveDashboard onConnectionStateChange={handleConnectionStateChange} />
          </>
        ) : (
          <ArchitectureDiagram />
        )}
      </div>
      
      <Footer />
    </div>
  );
}

export default function HomeClient() {
  return (
    <KioskModeProvider>
      <HomeContent />
    </KioskModeProvider>
  );
}
