'use client';

import {
  makeStyles,
  shorthands,
} from '@griffel/react';
import {
  Text,
  Title3,
  Display,
} from '@fluentui/react-text';
import {
  Card,
  CardHeader,
  CardPreview,
} from '@fluentui/react-card';
import {
  DeviceMeetingRoom24Regular,
  DataUsage24Regular,
  Router24Regular,
  CheckmarkCircle24Regular,
} from '@fluentui/react-icons';

const useStyles = makeStyles({
  container: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    ...shorthands.gap('24px'),
    ...shorthands.padding('24px', '0'),
  },
  card: {
    ...shorthands.padding('24px'),
    ...shorthands.borderRadius('12px'),
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    ':hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 28px rgba(0, 0, 0, 0.12)',
    },
    border: '1px solid #f0f0f0',
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '16px',
    ...shorthands.gap('12px'),
  },
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    ...shorthands.borderRadius('12px'),
    backgroundColor: '#eff6fc', // Light blue
    color: '#0078d4', // Brand blue
  },
  icon: {
    fontSize: '24px',
  },
  title: {
    color: '#605e5c',
    fontSize: '14px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  value: {
    display: 'block',
    color: '#201f1e',
    fontWeight: 700,
    fontSize: '36px',
    lineHeight: '1.2',
  },
  trend: {
    fontSize: '12px',
    color: '#107c10', // Green
    marginTop: '8px',
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
  }
});

export const OverviewCards = () => {
  const styles = useStyles();

  const cards = [
    { title: 'Active Devices', value: '124', icon: <DeviceMeetingRoom24Regular />, trend: '+12% vs last week' },
    { title: 'Messages Today', value: '4.5k', icon: <DataUsage24Regular />, trend: '+5% vs yesterday' },
    { title: 'Gateways Online', value: '8', icon: <Router24Regular />, trend: 'Stable' },
    { title: 'System Status', value: 'Healthy', icon: <CheckmarkCircle24Regular />, trend: '100% Uptime' },
  ];

  return (
    <div className={styles.container}>
      {cards.map((card, index) => (
        <div key={index} className={styles.card}>
          <div className={styles.header}>
            <div className={styles.iconContainer}>
              <span className={styles.icon}>{card.icon}</span>
            </div>
            <Text className={styles.title}>{card.title}</Text>
          </div>
          <div>
            <Text className={styles.value}>{card.value}</Text>
            <Text className={styles.trend}>{card.trend}</Text>
          </div>
        </div>
      ))}
    </div>
  );
};
