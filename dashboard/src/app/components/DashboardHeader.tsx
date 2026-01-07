'use client';

import { useEffect, useState } from 'react';
import {
  makeStyles,
  shorthands,
  mergeClasses,
} from '@griffel/react';
import {
  Text,
} from '@fluentui/react-text';
import {
  Avatar,
} from '@fluentui/react-avatar';
import {
  Button,
  ToggleButton,
} from '@fluentui/react-button';
import { 
  ArrowExit20Regular, 
  Shield20Regular, 
  WeatherMoon20Regular, 
  WeatherSunny20Regular,
  Home20Regular,
  Organization20Regular,
  FullScreenMaximize20Regular,
  Info20Regular,
  Beaker20Regular,
} from '@fluentui/react-icons';
import { tokens } from '@fluentui/react-theme';
import { fetchJson, AuthMeResponse } from '../lib/api';
import { useThemeMode } from '../providers';
import { ConnectionStatus, ConnectionState } from './common/ConnectionStatus';

// Microsoft Innovation Hub color palette
const hubColors = {
  hubGradientStart: '#0078D4',
  hubGradientEnd: '#004578',
};

const useStyles = makeStyles({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding('8px', '24px'),
    background: `linear-gradient(135deg, ${hubColors.hubGradientStart} 0%, ${hubColors.hubGradientEnd} 100%)`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    boxShadow: tokens.shadow4,
    color: 'white',
    minHeight: '56px',
    '@media (max-width: 768px)': {
      ...shorthands.padding('8px', '16px'),
      flexWrap: 'wrap',
      ...shorthands.gap('8px'),
    },
  },
  leftSection: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('16px'),
  },
  titleContainer: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
  },
  msLogo: {
    height: '24px',
    width: 'auto',
  },
  brandText: {
    display: 'flex',
    flexDirection: 'column',
    lineHeight: 1.2,
  },
  brandTitle: {
    color: 'white',
    fontWeight: 600,
    fontSize: '16px',
    letterSpacing: '-0.02em',
  },
  brandSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '11px',
    fontWeight: 400,
  },
  dividerLine: {
    height: '32px',
    width: '1px',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginLeft: '12px',
    marginRight: '12px',
  },
  projectTitle: {
    color: 'white',
    fontSize: '14px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('6px'),
  },
  beeIcon: {
    fontSize: '18px',
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('2px'),
    marginLeft: '16px',
    '@media (max-width: 768px)': {
      display: 'none',
    },
  },
  navButton: {
    minWidth: 'auto',
    color: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: 'transparent',
    ...shorthands.padding('6px', '12px'),
    borderRadius: tokens.borderRadiusMedium,
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      color: 'white',
    },
  },
  navButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: 'white',
  },
  centerSection: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('16px'),
  },
  userContainer: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
    '@media (max-width: 768px)': {
      ...shorthands.gap('4px'),
    },
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    '@media (max-width: 640px)': {
      display: 'none',
    },
  },
  userName: {
    fontWeight: 600,
    color: 'white',
    fontSize: '13px',
  },
  userRole: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '11px',
  },
  divider: {
    width: '1px',
    height: '24px',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginLeft: '8px',
    marginRight: '8px',
  },
  kioskButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    color: 'white',
    ...shorthands.padding('6px', '12px'),
    borderRadius: tokens.borderRadiusMedium,
    fontWeight: 600,
    fontSize: '12px',
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
  },
  actionButton: {
    color: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: 'transparent',
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      color: 'white',
    },
  },
});

type Section = 'dashboard' | 'apiary' | 'architecture' | 'about';

export interface DashboardHeaderProps {
  activeSection?: Section;
  onSectionChange?: (section: Section) => void;
  connectionState?: ConnectionState;
  lastUpdated?: Date | null;
  onKioskToggle?: () => void;
}

export const DashboardHeader = ({
  activeSection = 'dashboard',
  onSectionChange,
  connectionState = 'polling',
  lastUpdated,
  onKioskToggle,
}: DashboardHeaderProps) => {
  const styles = useStyles();

  const { isDark, setMode } = useThemeMode();

  const [user, setUser] = useState<{ name: string; roles: string[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const me = await fetchJson<AuthMeResponse>('/.auth/me');
        const cp = me?.clientPrincipal;
        if (!cp) return;
        if (!cancelled) {
          setUser({
            name: cp.userDetails || cp.userId,
            roles: Array.isArray(cp.userRoles) ? cp.userRoles : [],
          });
        }
      } catch {
        if (!cancelled) setUser(null);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const isAdmin = !!user?.roles?.includes('Admin');

  return (
    <header className={styles.header}>
      <div className={styles.leftSection}>
        <div className={styles.logoContainer}>
          {/* Microsoft Logo */}
          <svg 
            className={styles.msLogo} 
            viewBox="0 0 23 23" 
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Microsoft"
          >
            <rect x="0" y="0" width="11" height="11" fill="#f25022"/>
            <rect x="12" y="0" width="11" height="11" fill="#7fba00"/>
            <rect x="0" y="12" width="11" height="11" fill="#00a4ef"/>
            <rect x="12" y="12" width="11" height="11" fill="#ffb900"/>
          </svg>
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>Microsoft Innovation Hub</span>
            <span className={styles.brandSubtitle}>New York City</span>
          </div>
        </div>
        
        <div className={styles.dividerLine} />
        
        <div className={styles.projectTitle}>
          <span className={styles.beeIcon}>🐝</span>
          <span>Beehive Monitor</span>
        </div>
        
        <nav className={styles.navLinks}>
          <Button
            appearance="subtle"
            icon={<Home20Regular />}
            className={mergeClasses(
              styles.navButton,
              activeSection === 'dashboard' && styles.navButtonActive
            )}
            onClick={() => onSectionChange?.('dashboard')}
          >
            Dashboard
          </Button>
          <Button
            appearance="subtle"
            icon={<Beaker20Regular />}
            className={mergeClasses(
              styles.navButton,
              activeSection === 'apiary' && styles.navButtonActive
            )}
            onClick={() => onSectionChange?.('apiary')}
          >
            Apiary
          </Button>
          <Button
            appearance="subtle"
            icon={<Organization20Regular />}
            className={mergeClasses(
              styles.navButton,
              activeSection === 'architecture' && styles.navButtonActive
            )}
            onClick={() => onSectionChange?.('architecture')}
          >
            Architecture
          </Button>
          <Button
            appearance="subtle"
            icon={<Info20Regular />}
            className={mergeClasses(
              styles.navButton,
              activeSection === 'about' && styles.navButtonActive
            )}
            onClick={() => onSectionChange?.('about')}
          >
            About
          </Button>
        </nav>
      </div>

      <div className={styles.centerSection}>
        <ConnectionStatus
          state={connectionState}
          lastUpdated={lastUpdated}
          isAdmin={isAdmin}
        />
      </div>

      <div className={styles.userContainer}>
        <Button
          as="a"
          href="/kiosk"
          className={styles.kioskButton}
          icon={<FullScreenMaximize20Regular />}
          title="Open fullscreen kiosk mode"
        >
          Kiosk
        </Button>
        
        <ToggleButton
          checked={isDark}
          onClick={() => setMode(isDark ? 'light' : 'dark')}
          icon={isDark ? <WeatherSunny20Regular /> : <WeatherMoon20Regular />}
          className={styles.actionButton}
          appearance="subtle"
        />

        {isAdmin ? (
          <Button as="a" href="/admin" icon={<Shield20Regular />} className={styles.actionButton} appearance="subtle" />
        ) : null}

        <div className={styles.divider} />

        <div className={styles.userInfo}>
          <Text className={styles.userName}>{user?.name ?? '—'}</Text>
          <Text className={styles.userRole}>{isAdmin ? 'Admin' : 'User'}</Text>
        </div>
        <Avatar name={user?.name ?? 'User'} color="brand" size={28} />
        <Button
          as="a"
          href="/.auth/logout?post_logout_redirect_uri=/"
          icon={<ArrowExit20Regular />}
          className={styles.actionButton}
          appearance="subtle"
          title="Sign Out"
        />
      </div>
    </header>
  );
};
