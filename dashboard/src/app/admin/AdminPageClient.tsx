'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@fluentui/react-card';
import { Button } from '@fluentui/react-button';
import { Text, Title3 } from '@fluentui/react-text';
import { makeStyles, shorthands } from '@griffel/react';
import { tokens } from '@fluentui/react-theme';
import { DashboardHeader } from '../components/DashboardHeader';
import { fetchJson, HiveDetailResponse, OverviewResponse } from '../lib/api';

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
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr',
    ...shorthands.gap('16px'),
    '@media (max-width: 1024px)': {
      gridTemplateColumns: '1fr',
    },
  },
  card: {
    ...shorthands.padding('12px'),
    backgroundColor: tokens.colorNeutralBackground1,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    boxShadow: tokens.shadow8,
  },
  field: {
    display: 'grid',
    gridTemplateColumns: '160px 1fr',
    alignItems: 'center',
    ...shorthands.gap('8px', '12px'),
    marginTop: '10px',
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr',
    },
  },
  input: {
    ...shorthands.padding('8px', '10px'),
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
  },
  select: {
    width: '100%',
    ...shorthands.padding('8px', '10px'),
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    ...shorthands.gap('8px'),
    marginTop: '12px',
  },
  meta: {
    color: tokens.colorNeutralForeground3,
  },
});

export default function AdminPageClient() {
  const styles = useStyles();
  const router = useRouter();
  const search = useSearchParams();

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [detail, setDetail] = useState<HiveDetailResponse | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedHiveFromUrl = search.get('hive');
  const [selectedHive, setSelectedHive] = useState<string | null>(selectedHiveFromUrl);

  const hives = useMemo(() => (overview?.hives ?? []).filter(h => !!h.hiveIdentity), [overview]);

  useEffect(() => {
    setSelectedHive(selectedHiveFromUrl);
  }, [selectedHiveFromUrl]);

  useEffect(() => {
    let cancelled = false;
    async function loadOverview() {
      try {
        const o = await fetchJson<OverviewResponse>('/api/overview');
        if (!cancelled) setOverview(o);
      } catch {
        if (!cancelled) setOverview(null);
      }
    }
    loadOverview();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hives.length) return;
    if (selectedHive) return;
    router.replace(`/admin?hive=${encodeURIComponent(hives[0].hiveIdentity!)}`);
  }, [hives, selectedHive, router]);

  const [label, setLabel] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  useEffect(() => {
    if (!selectedHive) return;
    let cancelled = false;

    async function loadDetail() {
      try {
        const d = await fetchJson<HiveDetailResponse>(`/api/hives/${encodeURIComponent(selectedHive!)}`);
        if (cancelled) return;
        setDetail(d);
        setLabel(d.location?.label ?? '');
        setLatitude(d.location?.latitude != null ? String(d.location.latitude) : '');
        setLongitude(d.location?.longitude != null ? String(d.location.longitude) : '');
      } catch {
        if (!cancelled) setDetail(null);
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedHive]);

  async function save() {
    if (!selectedHive) return;
    setSaving(true);
    setStatus(null);

    try {
      const body = {
        label: label || null,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
      };

      await fetchJson(`/api/admin/hives/${encodeURIComponent(selectedHive)}/location`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      setStatus('Saved.');
      const d = await fetchJson<HiveDetailResponse>(`/api/hives/${encodeURIComponent(selectedHive!)}`);
      setDetail(d);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function clearOverride() {
    if (!selectedHive) return;
    setSaving(true);
    setStatus(null);

    try {
      await fetchJson(`/api/admin/hives/${encodeURIComponent(selectedHive)}/location`, {
        method: 'DELETE',
      });

      setStatus('Override cleared.');
      const d = await fetchJson<HiveDetailResponse>(`/api/hives/${encodeURIComponent(selectedHive!)}`);
      setDetail(d);
      setLabel(d.location?.label ?? '');
      setLatitude(d.location?.latitude != null ? String(d.location.latitude) : '');
      setLongitude(d.location?.longitude != null ? String(d.location.longitude) : '');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Failed to clear override');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.main}>
      <DashboardHeader />
      <div className={styles.content}>
        <div className={styles.grid}>
          <Card className={styles.card}>
            <Title3>Hive selection</Title3>
            <div className={styles.field}>
              <Text size={200}>Hive</Text>
              <select
                className={styles.select}
                value={selectedHive ?? ''}
                onChange={(e) => router.replace(`/admin?hive=${encodeURIComponent(e.target.value)}`)}
              >
                {hives.map(h => (
                  <option key={h.hiveIdentity!} value={h.hiveIdentity!}>{h.hiveName}</option>
                ))}
              </select>
            </div>
            <Text size={200} className={styles.meta}>
              Manual location overrides take precedence over gateway-derived coordinates.
            </Text>
          </Card>

          <Card className={styles.card}>
            <Title3>Location override</Title3>
            <Text size={200} className={styles.meta}>
              Current resolved location: {detail?.location?.label || (detail?.location?.latitude != null && detail?.location?.longitude != null
                ? `${Number(detail.location.latitude).toFixed(5)}, ${Number(detail.location.longitude).toFixed(5)}`
                : '—')}
            </Text>

            <div className={styles.field}>
              <Text size={200}>Label</Text>
              <input className={styles.input} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Yard A - Hive 3" />
            </div>
            <div className={styles.field}>
              <Text size={200}>Latitude</Text>
              <input className={styles.input} value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="40.7128" />
            </div>
            <div className={styles.field}>
              <Text size={200}>Longitude</Text>
              <input className={styles.input} value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="-74.0060" />
            </div>

            {status ? <Text size={200} className={styles.meta}>{status}</Text> : null}

            <div className={styles.actions}>
              <Button appearance="secondary" disabled={saving} onClick={clearOverride}>Clear override</Button>
              <Button appearance="primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
