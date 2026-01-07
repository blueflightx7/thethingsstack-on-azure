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
import { TemperatureHero } from './hero/TemperatureHero';
import { WeightHero } from './hero/WeightHero';
import { HiveNameEditor } from './common/HiveNameEditor';
import { useUnitPreferences } from '../contexts/UnitPreferencesContext';

const useStyles = makeStyles({
  card: {
    ...shorthands.padding('16px'),
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
    ...shorthands.padding('4px', '4px', '16px'),
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    marginBottom: '16px',
  },
  meta: {
    color: tokens.colorNeutralForeground3,
  },
  heroSection: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    ...shorthands.gap('16px'),
    marginBottom: '24px',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    ...shorthands.gap('8px', '16px'),
    ...shorthands.padding('12px'),
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    marginBottom: '16px',
    '@media (max-width: 1280px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
  },
  metricItem: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('2px'),
  },
  metricLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  metricValue: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
  },
  chartGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    ...shorthands.gap('12px'),
    '@media (max-width: 1280px)': {
      gridTemplateColumns: '1fr',
    },
  },
  chartCard: {
    ...shorthands.padding('12px'),
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow2,
    borderRadius: tokens.borderRadiusMedium,
    height: '240px',
  },
  chartTitle: {
    marginBottom: '8px',
    fontWeight: tokens.fontWeightSemibold,
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('6px'),
    ...shorthands.padding('4px', '8px'),
    borderRadius: tokens.borderRadiusMedium,
    fontSize: tokens.fontSizeBase200,
  },
  statusLive: {
    backgroundColor: '#E6F4EA',
    color: '#107C10',
  },
  statusLoading: {
    backgroundColor: '#FFF4CE',
    color: '#6B5900',
  },
  statusError: {
    backgroundColor: '#FDE7E9',
    color: '#A80000',
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
  const { formatTemp, formatWt, tempSymbol, wtSymbol, temperatureUnit, weightUnit } = useUnitPreferences();

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
      // Use native Fahrenheit from database when unit preference is fahrenheit
      temperatureInner: temperatureUnit === 'fahrenheit' 
        ? (p.temperatureInnerF ?? p.temperatureInner) 
        : p.temperatureInner,
      temperatureOuter: temperatureUnit === 'fahrenheit' 
        ? (p.temperatureOuterF ?? p.temperatureOuter) 
        : p.temperatureOuter,
    }));
  }, [series, temperatureUnit]);

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

  // Status badge helper
  const getStatusBadgeClass = () => {
    if (error) return `${styles.statusBadge} ${styles.statusError}`;
    if (loading) return `${styles.statusBadge} ${styles.statusLoading}`;
    return `${styles.statusBadge} ${styles.statusLive}`;
  };

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <div>
          <HiveNameEditor
            deviceId={hiveIdentity ?? ''}
            currentName={detail?.hiveName}
            onSave={(newName) => {
              // Trigger a refresh when name changes
              if (detail) {
                setDetail({ ...detail, hiveName: newName });
              }
            }}
          />
          <Text size={200} className={styles.meta}>
            📍 {locationLabel} • Last seen: {ageLabel(last)}
          </Text>
        </div>
        <span className={getStatusBadgeClass()}>
          {loading ? '◐ Refreshing…' : (error ? '✕ Error' : '● Live')}
        </span>
      </div>

      {error ? (
        <Text size={200} className={styles.meta}>{error}</Text>
      ) : null}

      {/* Hero Visualizations */}
      <div className={styles.heroSection}>
        <TemperatureHero
          current={detail?.telemetry?.temperatureInner as number | null | undefined}
          currentF={detail?.telemetry?.temperatureInnerF as number | null | undefined}
          label="Brood Chamber"
          type="brood"
          unit={temperatureUnit}
        />
        <TemperatureHero
          current={detail?.telemetry?.temperatureOuter as number | null | undefined}
          currentF={detail?.telemetry?.temperatureOuterF as number | null | undefined}
          label="Ambient"
          unit={temperatureUnit}
        />
        <WeightHero
          currentKg={detail?.telemetry?.weightKg as number | null | undefined}
          recentValues={chartData.map(d => d.weightKg).filter((v): v is number => v != null)}
          unit={weightUnit}
        />
      </div>

      {/* Secondary Metrics Grid */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Humidity</span>
          <span className={styles.metricValue}>
            {formatMaybeNumber(detail?.telemetry?.humidity as number | null | undefined, 1)}%
          </span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Battery</span>
          <span className={styles.metricValue}>
            {formatMaybeInt(detail?.telemetry?.batteryPercent as number | null | undefined)}%
          </span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Battery Voltage</span>
          <span className={styles.metricValue}>
            {formatMaybeNumber(detail?.telemetry?.batteryVoltage as number | null | undefined, 2)}V
          </span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Sound Energy</span>
          <span className={styles.metricValue}>
            {formatMaybeInt(detail?.telemetry?.soundEnergyTotal as number | null | undefined)}
          </span>
        </div>
      </div>

      <div className={styles.chartGrid}>
        <div className={styles.chartCard}>
          <Text className={styles.chartTitle}>Temperature History ({tempSymbol})</Text>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={tokens.colorNeutralStroke2} strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatTimeTick} minTickGap={24} />
              <YAxis width={40} />
              <Tooltip labelFormatter={(v) => formatTimestamp(String(v))} />
              <Legend />
              <Line type="monotone" dataKey="temperatureInner" name="Inner" stroke="#0078D4" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="temperatureOuter" name="Outer" stroke="#E87400" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <Text className={styles.chartTitle}>Humidity History (%)</Text>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={tokens.colorNeutralStroke2} strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatTimeTick} minTickGap={24} />
              <YAxis width={40} />
              <Tooltip labelFormatter={(v) => formatTimestamp(String(v))} />
              <Line type="monotone" dataKey="humidity" name="Humidity" stroke="#107C10" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <Text className={styles.chartTitle}>Weight History ({wtSymbol})</Text>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={tokens.colorNeutralStroke2} strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatTimeTick} minTickGap={24} />
              <YAxis width={40} />
              <Tooltip labelFormatter={(v) => formatTimestamp(String(v))} />
              <Line type="monotone" dataKey="weightKg" name="Weight" stroke="#0078D4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <Text className={styles.chartTitle}>Sound Energy History</Text>
          <ResponsiveContainer width="100%" height="85%">
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
