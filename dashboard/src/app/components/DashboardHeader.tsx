'use client';

import { useEffect, useState } from 'react';
import {
  makeStyles,
  shorthands,
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
import { ArrowExit20Regular, Shield20Regular, WeatherMoon20Regular, WeatherSunny20Regular } from '@fluentui/react-icons';
import { tokens } from '@fluentui/react-theme';
import { fetchJson, AuthMeResponse } from '../lib/api';
import { useThemeMode } from '../providers';

const useStyles = makeStyles({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding('16px', '32px'),
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    boxShadow: tokens.shadow4,
  },
  titleContainer: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
  },
  logoText: {
    color: tokens.colorBrandForeground1,
  },
  userContainer: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('16px'),
  },
  userName: {
    fontWeight: 600,
    color: tokens.colorNeutralForeground1,
  },
  userRole: {
    color: tokens.colorNeutralForeground3,
  }
});

export const DashboardHeader = () => {
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
      <div className={styles.titleContainer}>
        <Title1 className={styles.logoText}>The Things Stack</Title1>
        <Text size={500} weight="medium" className={styles.userRole}>
          | Azure Dashboard
        </Text>
      </div>
      <div className={styles.userContainer}>
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

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <Text className={styles.userName}>{user?.name ?? '—'}</Text>
          <Text size={200} className={styles.userRole}>{isAdmin ? 'Administrator' : 'User'}</Text>
        </div>
        <Avatar name={user?.name ?? 'User'} color="brand" />
        <Button
          as="a"
          href="/.auth/logout?post_logout_redirect_uri=/"
          icon={<ArrowExit20Regular />}
          appearance="subtle"
        >
          Sign Out
        </Button>
      </div>
    </header>
  );
};
