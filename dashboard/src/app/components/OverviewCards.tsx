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
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    ...shorthands.gap('20px'),
    ...shorthands.padding('20px'),
  },
  card: {
    ...shorthands.padding('15px'),
  },
  icon: {
    fontSize: '32px',
    color: '#0078d4',
  },
  value: {
    marginTop: '10px',
    display: 'block',
  },
});

export const OverviewCards = () => {
  const styles = useStyles();

  const cards = [
    { title: 'Active Devices', value: '124', icon: <DeviceMeetingRoom24Regular /> },
    { title: 'Messages Today', value: '4,521', icon: <DataUsage24Regular /> },
    { title: 'Gateways Online', value: '8', icon: <Router24Regular /> },
    { title: 'System Status', value: 'Healthy', icon: <CheckmarkCircle24Regular /> },
  ];

  return (
    <div className={styles.container}>
      {cards.map((card, index) => (
        <Card key={index} className={styles.card}>
          <CardHeader
            image={card.icon}
            header={<Text weight="semibold">{card.title}</Text>}
          />
          <Display className={styles.value}>{card.value}</Display>
        </Card>
      ))}
    </div>
  );
};
