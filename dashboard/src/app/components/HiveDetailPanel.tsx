'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@fluentui/react-card';
import { Text, Title3 } from '@fluentui/react-text';
import { makeStyles, shorthands } from '@griffel/react';
import { tokens } from '@fluentui/react-theme';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  fetchJson,
  HiveDetailResponse,
  HiveSeriesPoint,
  HiveSeriesResponse,
} from '../lib/api';
import { ageLabel, formatMaybeInt, formatMaybeNumber, formatTimestamp } from '../lib/format';

const useStyles = makeStyles({
  card: {
    ...shorthands.padding('12px'),
    backgroundColor: tokens.colorNeutralBackground1,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    boxShadow: tokens.shadow8,
    minHeight: '520px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    ...shorthands.gap('12px'),
    ...shorthands.padding('4px', '4px', '12px'),
  },
  meta: {
    color: tokens.colorNeutralForeground3,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    ...shorthands.gap('8px', '16px'),
    ...shorthands.padding('8px', '4px'),
    '@media (max-width: 1280px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
  },
  chartGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    ...shorthands.gap('12px'),
    marginTop: '12px',
    '@media (max-width: 1280px)': {
      gridTemplateColumns: '1fr',
    },
  },
  chartCard: {
    ...shorthands.padding('10px'),
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow2,
    height: '260px',
  },
  chartTitle: {
    marginBottom: '6px',
  },
});

type NegotiateResponse = { url?: string };

function formatTimeTick(v: unknown): string {
  const s = String(v);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function useHiveRealtimeInvalidation(enabled: boolean, onInvalidate: () => void) {
  const invalidateRef = useRef(onInvalidate);
  invalidateRef.current = onInvalidate;

  useEffect(() => {
    if (!enabled) return;

    let ws: WebSocket | null = null;
    let cancelled = false;

    async function connect() {
      try {
        const negotiate = await fetchJson<NegotiateResponse>('/api/negotiate', { method: 'POST' });
        const url = negotiate?.url;
        if (!url) return;
        if (cancelled) return;

        ws = new WebSocket(url, 'json.webpubsub.azure.v1');

        ws.onmessage = (evt) => {
          try {
            const raw = typeof evt.data === 'string' ? evt.data : '';
            const msg = raw ? JSON.parse(raw) : null;

            // Common shapes:
            // - { type: 'message', data: '...' }
            // - { type: 'message', dataType: 'json', data: {...} }
            // - { type: 'telemetry', data: {...} } (if routed by client)
            let payload: unknown = msg;
            if (msg && typeof msg === 'object' && 'data' in msg) {
              payload = (msg as { data?: unknown }).data;
            }

            if (typeof payload === 'string') {
              try {
                payload = JSON.parse(payload);
              } catch {
                // ignore
              }
            }

            invalidateRef.current();
          } catch {
            invalidateRef.current();
          }
        };
      } catch {
        // optional; polling still works
      }
    }

    connect();

    return () => {
      cancelled = true;
      try {
        ws?.close();
      } catch {
        // ignore
      }
    };
  }, [enabled]);
}

export function HiveDetailPanel({ hiveIdentity }: { hiveIdentity: string | null }) {
  const styles = useStyles();

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<HiveDetailResponse | null>(null);
  const [series, setSeries] = useState<HiveSeriesPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!hiveIdentity) return;
    setLoading(true);
    setError(null);

    try {
      const [d, s] = await Promise.all([
        fetchJson<HiveDetailResponse>(`/api/hives/${encodeURIComponent(hiveIdentity)}`),
        fetchJson<HiveSeriesResponse>(`/api/hives/${encodeURIComponent(hiveIdentity)}/series?minutes=240&maxPoints=480`),
      ]);

      setDetail(d);
      setSeries(Array.isArray(s.points) ? s.points : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load hive data');
      setDetail(null);
      setSeries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hiveIdentity) return;
    void load();

    const id = window.setInterval(() => {
      void load();
    }, 30000);

    return () => {
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiveIdentity]);

  useHiveRealtimeInvalidation(!!hiveIdentity, () => {
    void load();
  });

  const chartData = useMemo(() => {
    return series.map(p => ({
      ...p,
      timestamp: p.timestamp,
    }));
  }, [series]);

  if (!hiveIdentity) {
    return (
      <Card className={styles.card}>
        <Title3>Select a hive</Title3>
        <Text size={200} className={styles.meta}>Choose a hive tile to see details and charts.</Text>
      </Card>
    );
  }

  const last = detail?.lastMeasurementAt ?? detail?.lastSeenAt ?? null;
  const coords = detail?.location?.latitude != null && detail?.location?.longitude != null
    ? `${Number(detail.location.latitude).toFixed(5)}, ${Number(detail.location.longitude).toFixed(5)}`
    : '—';
  const locationLabel = detail?.location?.label || coords;

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <div>
          <Title3>{detail?.hiveName ?? 'Hive'}</Title3>
          <Text size={200} className={styles.meta}>
            Location: {locationLabel} • Last: {ageLabel(last)} • {formatTimestamp(last)}
          </Text>
        </div>
        <Text size={200} className={styles.meta}>{loading ? 'Refreshing…' : (error ? 'Error' : 'Live')}</Text>
      </div>

      {error ? (
        <Text size={200} className={styles.meta}>{error}</Text>
      ) : null}

      <div className={styles.grid}>
        <Text size={200}>
          Inner °C: {formatMaybeNumber(detail?.telemetry?.temperatureInner as number | null | undefined, 1)}
        </Text>
        <Text size={200}>
          Outer °C: {formatMaybeNumber(detail?.telemetry?.temperatureOuter as number | null | undefined, 1)}
        </Text>
        <Text size={200}>
          Humidity: {formatMaybeNumber(detail?.telemetry?.humidity as number | null | undefined, 1)}
        </Text>
        <Text size={200}>
          Weight kg: {formatMaybeNumber(detail?.telemetry?.weightKg as number | null | undefined, 1)}
        </Text>
        <Text size={200}>
          Battery: {formatMaybeInt(detail?.telemetry?.batteryPercent as number | null | undefined)}%
        </Text>
        <Text size={200}>
          Battery V: {formatMaybeNumber(detail?.telemetry?.batteryVoltage as number | null | undefined, 2)}
        </Text>
        <Text size={200}>
          Sound energy: {formatMaybeInt(detail?.telemetry?.soundEnergyTotal as number | null | undefined)}
        </Text>
        <Text size={200}>
          Sound band: {detail?.telemetry?.soundDominantBinRange ?? '—'}
        </Text>
      </div>

      <div className={styles.chartGrid}>
        <div className={styles.chartCard}>
          <Text className={styles.chartTitle}>Temperature (°C)</Text>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={tokens.colorNeutralStroke2} strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatTimeTick} minTickGap={24} />
              <YAxis width={40} />
              <Tooltip labelFormatter={(v) => formatTimestamp(String(v))} />
              <Legend />
              <Line type="monotone" dataKey="temperatureInner" name="Inner" stroke={tokens.colorBrandForeground1} dot={false} />
              <Line type="monotone" dataKey="temperatureOuter" name="Outer" stroke={tokens.colorPaletteDarkOrangeForeground1} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <Text className={styles.chartTitle}>Humidity</Text>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={tokens.colorNeutralStroke2} strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatTimeTick} minTickGap={24} />
              <YAxis width={40} />
              <Tooltip labelFormatter={(v) => formatTimestamp(String(v))} />
              <Line type="monotone" dataKey="humidity" name="Humidity" stroke={tokens.colorPaletteLightGreenForeground1} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <Text className={styles.chartTitle}>Weight (kg)</Text>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={tokens.colorNeutralStroke2} strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatTimeTick} minTickGap={24} />
              <YAxis width={40} />
              <Tooltip labelFormatter={(v) => formatTimestamp(String(v))} />
              <Line type="monotone" dataKey="weightKg" name="Weight" stroke={tokens.colorPaletteBlueForeground2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <Text className={styles.chartTitle}>Sound energy</Text>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={tokens.colorNeutralStroke2} strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatTimeTick} minTickGap={24} />
              <YAxis width={40} />
              <Tooltip labelFormatter={(v) => formatTimestamp(String(v))} />
              <Legend />
              <Line type="monotone" dataKey="soundEnergyLow" name="Low" stroke={tokens.colorPaletteRedForeground2} dot={false} />
              <Line type="monotone" dataKey="soundEnergyMid" name="Mid" stroke={tokens.colorPaletteDarkOrangeForeground1} dot={false} />
              <Line type="monotone" dataKey="soundEnergyHigh" name="High" stroke={tokens.colorPaletteLightGreenForeground1} dot={false} />
              <Line type="monotone" dataKey="soundEnergyTotal" name="Total" stroke={tokens.colorNeutralForeground1} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <Text className={styles.chartTitle}>Battery</Text>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={tokens.colorNeutralStroke2} strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatTimeTick} minTickGap={24} />
              <YAxis width={40} />
              <Tooltip labelFormatter={(v) => formatTimestamp(String(v))} />
              <Legend />
              <Line type="monotone" dataKey="batteryPercent" name="%" stroke={tokens.colorPaletteLightGreenForeground1} dot={false} />
              <Line type="monotone" dataKey="batteryVoltage" name="V" stroke={tokens.colorPaletteBlueForeground2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <Text className={styles.chartTitle}>Signal quality</Text>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={tokens.colorNeutralStroke2} strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatTimeTick} minTickGap={24} />
              <YAxis width={40} />
              <Tooltip labelFormatter={(v) => formatTimestamp(String(v))} />
              <Legend />
              <Line type="monotone" dataKey="rssi" name="RSSI" stroke={tokens.colorPaletteRedForeground2} dot={false} />
              <Line type="monotone" dataKey="snr" name="SNR" stroke={tokens.colorPaletteDarkOrangeForeground1} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
