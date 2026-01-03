'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@fluentui/react-card';
import { Badge } from '@fluentui/react-badge';
import { Spinner } from '@fluentui/react-spinner';
import { Text, Title3 } from '@fluentui/react-text';
import { makeStyles, shorthands } from '@griffel/react';
import { tokens } from '@fluentui/react-theme';
import { fetchJson, OverviewHive, OverviewResponse } from '../lib/api';
import { ageLabel, formatMaybeNumber, freshnessKind } from '../lib/format';
import { HiveDetailPanel } from './HiveDetailPanel';

const useStyles = makeStyles({
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr',
    ...shorthands.gap('16px'),
    '@media (max-width: 1024px)': {
      gridTemplateColumns: '1fr',
    },
  },
  listCard: {
    ...shorthands.padding('12px'),
    backgroundColor: tokens.colorNeutralBackground1,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    boxShadow: tokens.shadow8,
    minHeight: '520px',
  },
  listHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    ...shorthands.padding('4px', '4px', '12px'),
  },
  tiles: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('10px'),
  },
  tile: {
    ...shorthands.padding('12px'),
    backgroundColor: tokens.colorNeutralBackground1,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    boxShadow: tokens.shadow2,
    cursor: 'pointer',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground2,
    },
  },
  tileSelected: {
    border: `${tokens.strokeWidthThin} solid ${tokens.colorBrandStroke1}`,
  },
  tileTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    ...shorthands.gap('12px'),
  },
  tileName: {
    fontWeight: tokens.fontWeightSemibold,
  },
  tileMeta: {
    color: tokens.colorNeutralForeground3,
  },
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    ...shorthands.gap('6px', '12px'),
    marginTop: '8px',
  },
});

function badgeAppearance(kind: 'good' | 'warning' | 'critical'): 'filled' | 'outline' {
  return kind === 'good' ? 'filled' : 'outline';
}

function badgeColor(kind: 'good' | 'warning' | 'critical'): 'success' | 'warning' | 'danger' {
  if (kind === 'good') return 'success';
  if (kind === 'warning') return 'warning';
  return 'danger';
}

function resolvedLastTimestamp(h: OverviewHive): string | null {
  return (h.lastMeasurementAt ?? h.lastSeenAt ?? null) as string | null;
}

export function HiveDashboard() {
  const styles = useStyles();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const router = useRouter();
  const search = useSearchParams();

  const selectedFromUrl = search.get('hive');
  const hives = overview?.hives ?? [];

  const [selectedHive, setSelectedHive] = useState<string | null>(selectedFromUrl);

  useEffect(() => {
    setSelectedHive(selectedFromUrl);
  }, [selectedFromUrl]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const json = await fetchJson<OverviewResponse>('/api/overview');
        if (!cancelled) setOverview(json);
      } catch {
        if (!cancelled) setOverview(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!overview?.hives?.length) return;
    if (selectedHive) return;

    const first = overview.hives.find(h => !!h.hiveIdentity)?.hiveIdentity ?? null;
    if (!first) return;

    router.replace(`/?hive=${encodeURIComponent(first)}`);
  }, [overview, selectedHive, router]);

  const selectedHiveIdentity = useMemo(() => {
    if (!selectedHive) return null;
    const found = hives.find(h => h.hiveIdentity === selectedHive);
    return found?.hiveIdentity ?? selectedHive;
  }, [hives, selectedHive]);

  return (
    <div className={styles.layout}>
      <Card className={styles.listCard}>
        <div className={styles.listHeader}>
          <Title3>Hives</Title3>
          <Text size={200} className={styles.tileMeta}>
            {loading ? 'Loading…' : (overview ? `${hives.length}` : 'Unavailable')}
          </Text>
        </div>

        {loading ? (
          <Spinner size="medium" />
        ) : !overview ? (
          <Text size={200}>Unable to load hives.</Text>
        ) : hives.length === 0 ? (
          <Text size={200}>No hive data available yet.</Text>
        ) : (
          <div className={styles.tiles}>
            {hives
              .filter(h => !!h.hiveIdentity)
              .map((h) => {
                const last = resolvedLastTimestamp(h);
                const kind = freshnessKind(last);
                const coords = h.location?.latitude != null && h.location?.longitude != null
                  ? `${Number(h.location.latitude).toFixed(5)}, ${Number(h.location.longitude).toFixed(5)}`
                  : '—';
                const label = h.location?.label || coords;
                const isSelected = selectedHiveIdentity === h.hiveIdentity;

                return (
                  <div
                    key={h.hiveIdentity!}
                    className={`${styles.tile} ${isSelected ? styles.tileSelected : ''}`}
                    onClick={() => router.replace(`/?hive=${encodeURIComponent(h.hiveIdentity!)}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.replace(`/?hive=${encodeURIComponent(h.hiveIdentity!)}`);
                      }
                    }}
                  >
                    <div className={styles.tileTop}>
                      <div>
                        <Text className={styles.tileName}>{h.hiveName}</Text>
                        <Text size={200} className={styles.tileMeta}>{label}</Text>
                      </div>
                      <Badge color={badgeColor(kind)} appearance={badgeAppearance(kind)}>
                        {ageLabel(last)}
                      </Badge>
                    </div>

                    <div className={styles.metrics}>
                      <Text size={200} className={styles.tileMeta}>
                        Inner °C: {formatMaybeNumber(h.telemetry?.temperatureInner as number | null | undefined, 1)}
                      </Text>
                      <Text size={200} className={styles.tileMeta}>
                        Outer °C: {formatMaybeNumber(h.telemetry?.temperatureOuter as number | null | undefined, 1)}
                      </Text>
                      <Text size={200} className={styles.tileMeta}>
                        Humidity: {formatMaybeNumber(h.telemetry?.humidity as number | null | undefined, 1)}
                      </Text>
                      <Text size={200} className={styles.tileMeta}>
                        Weight kg: {formatMaybeNumber(h.telemetry?.weightKg as number | null | undefined, 1)}
                      </Text>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </Card>

      <HiveDetailPanel hiveIdentity={selectedHiveIdentity} />
    </div>
  );
}
