'use client';

import {
  makeStyles,
  shorthands,
} from '@griffel/react';
import {
  Text,
  Title3,
} from '@fluentui/react-text';
import {
  Card,
  CardHeader,
} from '@fluentui/react-card';

const useStyles = makeStyles({
  card: {
    ...shorthands.margin('24px', '0'),
    height: '400px',
    ...shorthands.borderRadius('12px'),
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
    border: '1px solid #f0f0f0',
  },
  header: {
    ...shorthands.padding('20px', '24px'),
    borderBottom: '1px solid #f0f0f0',
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    backgroundColor: '#fafafa',
    color: '#605e5c',
    ...shorthands.gap('16px'),
  },
  chartIcon: {
    fontSize: '48px',
    color: '#d0d0d0',
  }
});

export const RealtimeChart = () => {
  const styles = useStyles();

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <Title3>Realtime Message Ingestion</Title3>
        <Text style={{ display: 'block', color: '#605e5c', fontSize: '12px', marginTop: '4px' }}>
          Live data stream via Azure Web PubSub
        </Text>
      </div>
      <div className={styles.placeholder}>
        <div className={styles.chartIcon}>📊</div>
        <Text size={400} weight="medium">Waiting for live data stream...</Text>
        <Text size={200}>Connects to Azure Web PubSub service</Text>
      </div>
    </Card>
  );
};
