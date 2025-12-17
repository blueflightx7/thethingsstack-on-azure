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
    ...shorthands.padding('10px', '20px'),
    backgroundColor: '#f0f0f0', // Light gray background
    borderBottom: '1px solid #e0e0e0',
  },
  titleContainer: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('10px'),
  },
  userContainer: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('10px'),
  },
});

export const DashboardHeader = () => {
  const styles = useStyles();

  return (
    <header className={styles.header}>
      <div className={styles.titleContainer}>
        <Title1>The Things Stack on Azure</Title1>
        <Text size={400} weight="semibold">Dashboard</Text>
      </div>
      <div className={styles.userContainer}>
        <Text>Admin User</Text>
        <Avatar name="Admin User" />
        <Button icon={<ArrowExit20Regular />} appearance="subtle">Sign Out</Button>
      </div>
    </header>
  );
};
