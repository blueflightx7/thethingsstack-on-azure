'use client';

import { DashboardHeader } from './components/DashboardHeader';
import { OverviewCards } from './components/OverviewCards';
import { RealtimeChart } from './components/RealtimeChart';
import { ArchitectureDiagram } from './components/ArchitectureDiagram';
import { makeStyles, shorthands } from '@griffel/react';

const useStyles = makeStyles({
  main: {
    backgroundColor: '#faf9f8',
    minHeight: '100vh',
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    ...shorthands.padding('20px'),
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    ...shorthands.gap('20px'),
    '@media (max-width: 768px)': {
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
