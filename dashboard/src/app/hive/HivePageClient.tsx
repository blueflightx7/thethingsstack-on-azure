'use client';

import { useSearchParams } from 'next/navigation';
import { makeStyles, shorthands } from '@griffel/react';
import { tokens } from '@fluentui/react-theme';
import { DashboardHeader } from '../components/DashboardHeader';
import { HiveDetailPanel } from '../components/HiveDetailPanel';

const useStyles = makeStyles({
  main: {
    backgroundColor: tokens.colorNeutralBackground2,
    minHeight: '100vh',
  },
  content: {
    maxWidth: '1400px',
    margin: '0 auto',
    ...shorthands.padding('24px', '48px'),
    '@media (max-width: 768px)': {
      ...shorthands.padding('24px'),
    },
  },
});

export default function HivePageClient() {
  const styles = useStyles();
  const search = useSearchParams();
  const hive = search.get('hive') ?? search.get('id');

  return (
    <div className={styles.main}>
      <DashboardHeader />
      <div className={styles.content}>
        <HiveDetailPanel hiveIdentity={hive} />
      </div>
    </div>
  );
}
