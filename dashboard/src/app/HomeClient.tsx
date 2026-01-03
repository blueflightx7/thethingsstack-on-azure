'use client';

import { DashboardHeader } from './components/DashboardHeader';
import { OverviewStats } from './components/OverviewStats';
import { HiveDashboard } from './components/HiveDashboard';
import { makeStyles, shorthands } from '@griffel/react';
import { tokens } from '@fluentui/react-theme';

const useStyles = makeStyles({
  main: {
    backgroundColor: tokens.colorNeutralBackground2,
    minHeight: '100vh',
  },
  content: {
    maxWidth: '1400px',
    margin: '0 auto',
    ...shorthands.padding('32px', '48px'),
    '@media (max-width: 768px)': {
      ...shorthands.padding('24px'),
    },
  },
});

export default function HomeClient() {
  const styles = useStyles();

  return (
    <div className={styles.main}>
      <DashboardHeader />
      <div className={styles.content}>
        <OverviewStats />
        <HiveDashboard />
      </div>
    </div>
  );
}
