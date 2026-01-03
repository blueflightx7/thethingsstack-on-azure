'use client';

import { useEffect, useMemo, useState } from 'react';
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
  },
  statsRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'baseline',
    ...shorthands.gap('24px'),
  },
  stat: {
    textAlign: 'center',
  },
  statValue: {
    display: 'block',
    fontSize: '32px',
    fontWeight: 700,
    color: '#201f1e',
  },
  statLabel: {
    display: 'block',
    fontSize: '12px',
    color: '#605e5c',
  }
});

export const RealtimeChart = () => {
  const styles = useStyles();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    windowMinutes: number;
    points: Array<{ timestamp: string; count: number }>;
    lastMessageAt: string | null;
    messagesLastMinute: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function tick() {
      try {
        const res = await fetch('/api/realtime', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`Failed to load realtime: ${res.status}`);
        }
        const json = await res.json();
        if (!cancelled) {
          setData({
            windowMinutes: Number(json.windowMinutes ?? 30),
            points: Array.isArray(json.points) ? json.points : [],
            lastMessageAt: json.lastMessageAt ?? null,
            messagesLastMinute: Number(json.messagesLastMinute ?? 0),
          });
        }
      } catch {
        if (!cancelled) {
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }

      if (!cancelled) {
        timer = window.setTimeout(tick, 5000);
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const messagesInWindow = useMemo(() => {
    if (!data?.points?.length) return 0;
    return data.points.reduce((sum, p) => sum + Number(p.count ?? 0), 0);
  }, [data]);

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <Title3>Realtime Message Ingestion</Title3>
        <Text style={{ display: 'block', color: '#605e5c', fontSize: '12px', marginTop: '4px' }}>
          Live ingestion stats via Dashboard API
        </Text>
      </div>
      <div className={styles.placeholder}>
        <div className={styles.chartIcon}>📊</div>

        {loading ? (
          <>
            <Text size={400} weight="medium">Loading ingestion stats...</Text>
            <Text size={200}>Querying /api/realtime</Text>
          </>
        ) : data ? (
          <>
            <div className={styles.statsRow}>
              <div className={styles.stat}>
                <Text className={styles.statValue}>{data.messagesLastMinute}</Text>
                <Text className={styles.statLabel}>Messages (last minute)</Text>
              </div>
              <div className={styles.stat}>
                <Text className={styles.statValue}>{messagesInWindow}</Text>
                <Text className={styles.statLabel}>Messages (last {data.windowMinutes}m)</Text>
              </div>
            </div>
            <Text size={200}>
              Last message: {data.lastMessageAt ? new Date(data.lastMessageAt).toLocaleString() : '—'}
            </Text>
          </>
        ) : (
          <>
            <Text size={400} weight="medium">Realtime data unavailable</Text>
            <Text size={200}>Check the dashboard API / SQL connection</Text>
          </>
        )}
      </div>
    </Card>
  );
};
