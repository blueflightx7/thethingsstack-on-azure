'use client';

import { useEffect, useState } from 'react';
import {
  makeStyles,
  shorthands,
  mergeClasses,
} from '@griffel/react';
import {
  Title1,
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
} from '@fluentui/react-icons';
import { tokens } from '@fluentui/react-theme';
import { fetchJson, AuthMeResponse } from '../lib/api';
import { useThemeMode } from '../providers';
import { ConnectionStatus, ConnectionState } from './common/ConnectionStatus';

const useStyles = makeStyles({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding('12px', '24px'),
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    boxShadow: tokens.shadow4,
    '@media (max-width: 768px)': {
      ...shorthands.padding('12px', '16px'),
      flexWrap: 'wrap',
      ...shorthands.gap('12px'),
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
    ...shorthands.gap('12px'),
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('10px'),
  },
  azureLogo: {
    height: '28px',
    width: 'auto',
  },
  logoText: {
    color: '#0078D4', // Azure Blue
    fontWeight: tokens.fontWeightSemibold,
  },
  subtitle: {
    color: tokens.colorNeutralForeground3,
    marginLeft: '4px',
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
    marginLeft: '24px',
    '@media (max-width: 768px)': {
      display: 'none',
    },
  },
  navButton: {
    minWidth: 'auto',
  },
  navButtonActive: {
    backgroundColor: tokens.colorNeutralBackground1Hover,
  },
  centerSection: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('16px'),
  },
  userContainer: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
    '@media (max-width: 768px)': {
      ...shorthands.gap('8px'),
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
    color: tokens.colorNeutralForeground1,
  },
  userRole: {
    color: tokens.colorNeutralForeground3,
  },
  divider: {
    width: '1px',
    height: '24px',
    backgroundColor: tokens.colorNeutralStroke2,
    marginLeft: '8px',
    marginRight: '8px',
  },
});

export interface DashboardHeaderProps {
  activeSection?: 'home' | 'architecture';
  onSectionChange?: (section: 'home' | 'architecture') => void;
  connectionState?: ConnectionState;
  lastUpdated?: Date | null;
  onKioskToggle?: () => void;
}

export const DashboardHeader = ({
  activeSection = 'home',
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
          {/* Azure Logo SVG */}
          <svg 
            className={styles.azureLogo} 
            viewBox="0 0 96 96" 
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Microsoft Azure"
          >
            <defs>
              <linearGradient id="azure-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0078D4" />
                <stop offset="100%" stopColor="#5EA0EF" />
              </linearGradient>
            </defs>
            <path 
              fill="url(#azure-gradient)" 
              d="M33.338 6.544h26.038l-27.03 80.087a4.152 4.152 0 0 1-3.933 2.824H8.149a4.145 4.145 0 0 1-3.928-5.47L29.404 9.368a4.152 4.152 0 0 1 3.934-2.825zm53.576 56.747H42.155a1.556 1.556 0 0 0-1.065 2.69l28.554 26.453a4.165 4.165 0 0 0 2.828 1.11h22.428zm-43.64-47.91L23.887 63.29h30.095a4.165 4.165 0 0 0 2.828-1.11l35.618-32.96a4.165 4.165 0 0 0-2.828-6.84z"
            />
          </svg>
          <div className={styles.titleContainer}>
            <Title1 className={styles.logoText}>Azure IoT</Title1>
            <Text size={400} className={styles.subtitle}>
              Beehive Monitor
            </Text>
          </div>
        </div>
        
        <nav className={styles.navLinks}>
          <Button
            appearance="subtle"
            icon={<Home20Regular />}
            className={mergeClasses(
              styles.navButton,
              activeSection === 'home' && styles.navButtonActive
            )}
            onClick={() => onSectionChange?.('home')}
          >
            Dashboard
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
        {onKioskToggle && (
          <Button
            appearance="subtle"
            icon={<FullScreenMaximize20Regular />}
            onClick={onKioskToggle}
            title="Enter fullscreen kiosk mode"
          />
        )}
        
        <ToggleButton
          checked={isDark}
          onClick={() => setMode(isDark ? 'light' : 'dark')}
          icon={isDark ? <WeatherSunny20Regular /> : <WeatherMoon20Regular />}
          appearance="subtle"
        >
          {isDark ? 'Light' : 'Dark'}
        </ToggleButton>

        {isAdmin ? (
          <Button as="a" href="/admin" icon={<Shield20Regular />} appearance="subtle">
            Admin
          </Button>
        ) : null}

        <div className={styles.divider} />

        <div className={styles.userInfo}>
          <Text className={styles.userName}>{user?.name ?? '—'}</Text>
          <Text size={200} className={styles.userRole}>{isAdmin ? 'Administrator' : 'User'}</Text>
        </div>
        <Avatar name={user?.name ?? 'User'} color="brand" size={32} />
        <Button
          as="a"
          href="/.auth/logout?post_logout_redirect_uri=/"
          icon={<ArrowExit20Regular />}
          appearance="subtle"
          title="Sign Out"
        />
      </div>
    </header>
  );
};
