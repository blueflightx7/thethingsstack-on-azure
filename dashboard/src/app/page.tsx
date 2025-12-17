'use client';

import { DashboardHeader } from './components/DashboardHeader';
import { OverviewCards } from './components/OverviewCards';
import { RealtimeChart } from './components/RealtimeChart';
import { ArchitectureDiagram } from './components/ArchitectureDiagram';
import { makeStyles, shorthands } from '@griffel/react';

const useStyles = makeStyles({
  main: {
    backgroundColor: '#f8f8f8', // Slightly lighter gray
    minHeight: '100vh',
    fontFamily: '"Segoe UI", "Segoe UI Web (West European)", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", sans-serif',
  },
  content: {
    maxWidth: '1400px', // Wider container
    margin: '0 auto',
    ...shorthands.padding('32px', '48px'),
    '@media (max-width: 768px)': {
      ...shorthands.padding('24px'),
    },
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr', // Give chart more space
    ...shorthands.gap('24px'),
    marginTop: '24px',
    '@media (max-width: 1024px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export default function HomePage() {
  const styles = useStyles();

  return (
    <div className={styles.main}>
      <DashboardHeader />
      <div className={styles.content}>
        <OverviewCards />
        <div className={styles.grid}>
          <RealtimeChart />
          <ArchitectureDiagram />
        </div>
      </div>
    </div>
  );
}
