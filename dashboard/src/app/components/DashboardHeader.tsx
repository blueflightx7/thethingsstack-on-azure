'use client';

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
} from '@fluentui/react-button';
import { ArrowExit20Regular } from '@fluentui/react-icons';

const useStyles = makeStyles({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding('16px', '32px'),
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #f0f0f0',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
  },
  titleContainer: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
  },
  logoText: {
    color: '#0078d4', // Brand blue
  },
  userContainer: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('16px'),
  },
  userName: {
    fontWeight: 600,
    color: '#323130',
  }
});

export const DashboardHeader = () => {
  const styles = useStyles();

  return (
    <header className={styles.header}>
      <div className={styles.titleContainer}>
        <Title1 className={styles.logoText}>The Things Stack</Title1>
        <Text size={500} weight="medium" style={{ color: '#605e5c' }}>| Azure Dashboard</Text>
      </div>
      <div className={styles.userContainer}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <Text className={styles.userName}>Admin User</Text>
          <Text size={200} style={{ color: '#605e5c' }}>Administrator</Text>
        </div>
        <Avatar name="Admin User" color="brand" />
        <Button icon={<ArrowExit20Regular />} appearance="subtle">Sign Out</Button>
      </div>
    </header>
  );
};
