'use client';

import { useEffect, useState } from 'react';
import { Card } from '@fluentui/react-card';
import { Text, Title3 } from '@fluentui/react-text';
import { makeStyles, shorthands } from '@griffel/react';
import { tokens } from '@fluentui/react-theme';
import { fetchJson, OverviewResponse } from '../lib/api';

const useStyles = makeStyles({
  container: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    ...shorthands.gap('16px'),
    ...shorthands.padding('16px', '0'),
  },
  card: {
    ...shorthands.padding('16px'),
    backgroundColor: tokens.colorNeutralBackground1,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    boxShadow: tokens.shadow8,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    ...shorthands.gap('12px'),
  },
  value: {
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightHero700,
  },
  meta: {
    color: tokens.colorNeutralForeground3,
  },
});

export function OverviewStats() {
  const styles = useStyles();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OverviewResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const json = await fetchJson<OverviewResponse>('/api/overview');
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = [
    { label: 'Active devices', value: loading ? '—' : String(data?.activeDevices ?? '—') },
    { label: 'Messages (24h)', value: loading ? '—' : String(data?.messagesToday ?? '—') },
    { label: 'Gateways online', value: loading ? '—' : String(data?.gatewaysOnline ?? '—') },
    { label: 'System status', value: loading ? '—' : String(data?.systemStatus ?? '—') },
  ];

  return (
    <div className={styles.container}>
      {items.map((it) => (
        <Card key={it.label} className={styles.card}>
          <div className={styles.header}>
            <Title3>{it.label}</Title3>
            <Text size={200} className={styles.meta}>{loading ? 'Loading…' : 'API + SQL'}</Text>
          </div>
          <Text className={styles.value}>{it.value}</Text>
        </Card>
      ))}
    </div>
  );
}
