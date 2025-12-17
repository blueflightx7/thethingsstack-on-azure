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
    ...shorthands.margin('20px'),
    height: '400px',
  },
  placeholder: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    backgroundColor: '#f5f5f5',
    color: '#666',
  },
});

export const RealtimeChart = () => {
  const styles = useStyles();

  return (
    <Card className={styles.card}>
      <CardHeader header={<Title3>Realtime Message Ingestion (Web PubSub)</Title3>} />
      <div className={styles.placeholder}>
        <Text size={500}>Realtime Chart Placeholder (Waiting for Web PubSub connection...)</Text>
      </div>
    </Card>
  );
};
