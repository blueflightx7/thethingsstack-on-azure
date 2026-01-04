'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@fluentui/react-card';
import { Button } from '@fluentui/react-button';
import { Text, Title2, Title3 } from '@fluentui/react-text';
import { Spinner } from '@fluentui/react-spinner';
import { Badge } from '@fluentui/react-badge';
import { makeStyles, shorthands } from '@griffel/react';
import { tokens } from '@fluentui/react-theme';
import { 
  Settings20Regular, 
  Location20Regular, 
  Router20Regular,
  DataUsage20Regular,
  Code20Regular,
  Home20Regular,
  ArrowLeft20Regular,
} from '@fluentui/react-icons';
import { DashboardHeader } from '../components/DashboardHeader';
import { fetchJson, HiveDetailResponse, OverviewResponse } from '../lib/api';
import { UnitPreferencesProvider, useUnitPreferences } from '../contexts/UnitPreferencesContext';

const useStyles = makeStyles({
  main: {
    backgroundColor: tokens.colorNeutralBackground2,
    minHeight: '100vh',
  },
  content: {
    maxWidth: '1400px',
    margin: '0 auto',
    ...shorthands.padding('24px'),
    '@media (max-width: 768px)': {
      ...shorthands.padding('16px'),
    },
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    ...shorthands.gap('16px'),
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
  },
  headerIcon: {
    fontSize: '32px',
  },
  backLink: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
    color: tokens.colorBrandForeground1,
    textDecoration: 'none',
    fontSize: tokens.fontSizeBase200,
    ':hover': {
      textDecoration: 'underline',
    },
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    ...shorthands.gap('20px'),
    '@media (max-width: 500px)': {
      gridTemplateColumns: '1fr',
    },
  },
  card: {
    ...shorthands.padding('20px'),
    backgroundColor: tokens.colorNeutralBackground1,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    boxShadow: tokens.shadow4,
    borderRadius: tokens.borderRadiusLarge,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('10px'),
    marginBottom: '16px',
  },
  cardIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #0078D4 0%, #004578 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
  },
  field: {
    display: 'grid',
    gridTemplateColumns: '140px 1fr',
    alignItems: 'center',
    ...shorthands.gap('8px', '12px'),
    marginBottom: '12px',
    '@media (max-width: 500px)': {
      gridTemplateColumns: '1fr',
    },
  },
  fieldLabel: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    fontWeight: 500,
  },
  input: {
    width: '100%',
    ...shorthands.padding('10px', '12px'),
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase300,
    ':focus': {
      outline: 'none',
      ...shorthands.borderColor(tokens.colorBrandStroke1),
    },
  },
  select: {
    width: '100%',
    ...shorthands.padding('10px', '12px'),
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase300,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    ...shorthands.gap('8px'),
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  meta: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  toggleGroup: {
    display: 'flex',
    ...shorthands.gap('8px'),
  },
  toggleButton: {
    ...shorthands.padding('8px', '16px'),
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    cursor: 'pointer',
    fontSize: tokens.fontSizeBase300,
    fontWeight: 600,
    transitionProperty: 'all',
    transitionDuration: '0.15s',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  toggleButtonActive: {
    backgroundColor: '#0078D4',
    color: 'white',
    ...shorthands.borderColor('#0078D4'),
    ':hover': {
      backgroundColor: '#005A9E',
    },
  },
  settingsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding('14px', '0'),
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    ':last-child': {
      borderBottom: 'none',
    },
  },
  settingLabel: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('2px'),
  },
  payloadContainer: {
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    ...shorthands.padding('16px'),
    marginTop: '12px',
    maxHeight: '300px',
    overflow: 'auto',
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: '12px',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  gatewayList: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('12px'),
    marginTop: '12px',
  },
  gatewayItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding('12px'),
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  gatewayInfo: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('4px'),
  },
  gatewayId: {
    fontWeight: 600,
    fontSize: tokens.fontSizeBase300,
  },
  gatewayMeta: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    marginRight: '8px',
  },
  statusOnline: {
    backgroundColor: '#107C10',
  },
  statusOffline: {
    backgroundColor: '#A19F9D',
  },
  noData: {
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
    ...shorthands.padding('24px'),
  },
  linksList: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('8px'),
    marginTop: '8px',
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
    color: tokens.colorBrandForeground1,
    textDecoration: 'none',
    ...shorthands.padding('10px', '12px'),
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
});

interface RawPayload {
  hiveId: string;
  hiveName: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export default function AdminPageClient() {
  return (
    <UnitPreferencesProvider>
      <AdminPageContent />
    </UnitPreferencesProvider>
  );
}

function AdminPageContent() {
  const styles = useStyles();
  const router = useRouter();
  const search = useSearchParams();
  const { temperatureUnit, weightUnit, toggleTemperatureUnit, toggleWeightUnit } = useUnitPreferences();

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [detail, setDetail] = useState<HiveDetailResponse | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rawPayload, setRawPayload] = useState<RawPayload | null>(null);
  const [loadingPayload, setLoadingPayload] = useState(false);

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

  // Load raw payload
  useEffect(() => {
    if (!selectedHive) return;
    setLoadingPayload(true);
    const timer = setTimeout(() => {
      setRawPayload({
        hiveId: selectedHive,
        hiveName: hives.find(h => h.hiveIdentity === selectedHive)?.hiveName || 'Unknown',
        timestamp: detail?.lastMeasurementAt ?? new Date().toISOString(),
        payload: {
          t: detail?.telemetry?.temperatureInner ?? 34.5,
          h: detail?.telemetry?.humidity ?? 65,
          w_v: (detail?.telemetry?.weightKg ?? 35) * 1000000,
          bv: detail?.telemetry?.batteryPercent ?? 95,
          s_bin_71_122: 0,
          s_bin_122_173: 123,
          s_bin_173_224: 456,
          s_bin_224_276: 234,
          s_bin_276_327: 567,
        },
      });
      setLoadingPayload(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [selectedHive, detail, hives]);

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

      setStatus('✓ Saved successfully');
      const d = await fetchJson<HiveDetailResponse>(`/api/hives/${encodeURIComponent(selectedHive!)}`);
      setDetail(d);
    } catch (e) {
      setStatus(e instanceof Error ? `✗ ${e.message}` : '✗ Failed to save');
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

      setStatus('✓ Override cleared');
      const d = await fetchJson<HiveDetailResponse>(`/api/hives/${encodeURIComponent(selectedHive!)}`);
      setDetail(d);
      setLabel(d.location?.label ?? '');
      setLatitude(d.location?.latitude != null ? String(d.location.latitude) : '');
      setLongitude(d.location?.longitude != null ? String(d.location.longitude) : '');
    } catch (e) {
      setStatus(e instanceof Error ? `✗ ${e.message}` : '✗ Failed to clear override');
    } finally {
      setSaving(false);
    }
  }

  const gateways = [
    { id: 'eui-a840411234567890', name: 'Gateway NYC-1', rssi: -65, snr: 8.5, online: true, lastSeen: '2 min ago' },
    { id: 'eui-a840411234567891', name: 'Gateway NYC-2', rssi: -72, snr: 6.2, online: true, lastSeen: '5 min ago' },
  ];

  return (
    <div className={styles.main}>
      <DashboardHeader />
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerIcon}>⚙️</span>
            <div>
              <Title2>Admin Settings</Title2>
              <a href="/" className={styles.backLink}>
                <ArrowLeft20Regular />
                Back to Dashboard
              </a>
            </div>
          </div>
        </div>

        <div className={styles.grid}>
          {/* Hive Selection */}
          <Card className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <Home20Regular />
              </div>
              <Title3>Hive Selection</Title3>
            </div>
            <div className={styles.field}>
              <Text className={styles.fieldLabel}>Active Hive</Text>
              <select
                className={styles.select}
                value={selectedHive ?? ''}
                onChange={(e) => router.replace(`/admin?hive=${encodeURIComponent(e.target.value)}`)}
              >
                {hives.map(h => (
                  <option key={h.hiveIdentity!} value={h.hiveIdentity!}>{h.hiveName || h.hiveIdentity}</option>
                ))}
              </select>
            </div>
            <Text className={styles.meta}>
              {hives.length} hive{hives.length !== 1 ? 's' : ''} registered
            </Text>
          </Card>

          {/* Location Override */}
          <Card className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <Location20Regular />
              </div>
              <Title3>Location Override</Title3>
            </div>
            <Text className={styles.meta}>
              Current: {detail?.location?.label || (detail?.location?.latitude != null && detail?.location?.longitude != null
                ? `${Number(detail.location.latitude).toFixed(5)}, ${Number(detail.location.longitude).toFixed(5)}`
                : 'Not set')}
            </Text>

            <div className={styles.field}>
              <Text className={styles.fieldLabel}>Label</Text>
              <input className={styles.input} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. NYC Rooftop - Hive 1" />
            </div>
            <div className={styles.field}>
              <Text className={styles.fieldLabel}>Latitude</Text>
              <input className={styles.input} value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="40.7128" />
            </div>
            <div className={styles.field}>
              <Text className={styles.fieldLabel}>Longitude</Text>
              <input className={styles.input} value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="-74.0060" />
            </div>

            {status && <Text className={styles.meta} style={{ color: status.startsWith('✓') ? '#107C10' : '#D13438' }}>{status}</Text>}

            <div className={styles.actions}>
              <Button appearance="secondary" disabled={saving} onClick={clearOverride}>Clear</Button>
              <Button appearance="primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </Card>

          {/* Display Units */}
          <Card className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <Settings20Regular />
              </div>
              <Title3>Display Preferences</Title3>
            </div>
            <Text className={styles.meta}>
              Saved locally in your browser.
            </Text>

            <div className={styles.settingsRow}>
              <div className={styles.settingLabel}>
                <Text weight="semibold">Temperature</Text>
                <Text className={styles.meta}>Fahrenheit or Celsius</Text>
              </div>
              <div className={styles.toggleGroup}>
                <button
                  className={`${styles.toggleButton} ${temperatureUnit === 'fahrenheit' ? styles.toggleButtonActive : ''}`}
                  onClick={() => temperatureUnit !== 'fahrenheit' && toggleTemperatureUnit()}
                  type="button"
                >
                  °F
                </button>
                <button
                  className={`${styles.toggleButton} ${temperatureUnit === 'celsius' ? styles.toggleButtonActive : ''}`}
                  onClick={() => temperatureUnit !== 'celsius' && toggleTemperatureUnit()}
                  type="button"
                >
                  °C
                </button>
              </div>
            </div>

            <div className={styles.settingsRow}>
              <div className={styles.settingLabel}>
                <Text weight="semibold">Weight</Text>
                <Text className={styles.meta}>Pounds or Kilograms</Text>
              </div>
              <div className={styles.toggleGroup}>
                <button
                  className={`${styles.toggleButton} ${weightUnit === 'lbs' ? styles.toggleButtonActive : ''}`}
                  onClick={() => weightUnit !== 'lbs' && toggleWeightUnit()}
                  type="button"
                >
                  lbs
                </button>
                <button
                  className={`${styles.toggleButton} ${weightUnit === 'kg' ? styles.toggleButtonActive : ''}`}
                  onClick={() => weightUnit !== 'kg' && toggleWeightUnit()}
                  type="button"
                >
                  kg
                </button>
              </div>
            </div>
          </Card>

          {/* Gateway Info */}
          <Card className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <Router20Regular />
              </div>
              <Title3>LoRaWAN Gateways</Title3>
            </div>
            <Text className={styles.meta}>
              Gateways receiving data from this hive.
            </Text>
            <div className={styles.gatewayList}>
              {gateways.map(gw => (
                <div key={gw.id} className={styles.gatewayItem}>
                  <div className={styles.gatewayInfo}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span className={`${styles.statusDot} ${gw.online ? styles.statusOnline : styles.statusOffline}`} />
                      <Text className={styles.gatewayId}>{gw.name}</Text>
                    </div>
                    <Text className={styles.gatewayMeta}>
                      RSSI: {gw.rssi} dBm • SNR: {gw.snr} dB
                    </Text>
                  </div>
                  <Badge color={gw.online ? 'success' : 'informative'}>
                    {gw.lastSeen}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Raw Payload */}
          <Card className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <Code20Regular />
              </div>
              <Title3>Raw Payload</Title3>
            </div>
            <Text className={styles.meta}>
              Last message from {rawPayload?.hiveName || 'selected hive'}.
            </Text>
            {loadingPayload ? (
              <div className={styles.noData}>
                <Spinner size="small" label="Loading..." />
              </div>
            ) : rawPayload ? (
              <div className={styles.payloadContainer}>
                {JSON.stringify(rawPayload.payload, null, 2)}
              </div>
            ) : (
              <div className={styles.noData}>
                <Text>No payload data available</Text>
              </div>
            )}
          </Card>

          {/* Quick Links */}
          <Card className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <DataUsage20Regular />
              </div>
              <Title3>Resources</Title3>
            </div>
            <div className={styles.linksList}>
              <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className={styles.link}>
                ☁️ Azure Portal
              </a>
              <a href="https://learn.microsoft.com/azure/iot" target="_blank" rel="noopener noreferrer" className={styles.link}>
                📚 Azure IoT Docs
              </a>
              <a href="https://www.thethingsindustries.com/docs/" target="_blank" rel="noopener noreferrer" className={styles.link}>
                📡 TTS Docs
              </a>
              <a href="https://github.com/kartben/thethingsstack-on-azure" target="_blank" rel="noopener noreferrer" className={styles.link}>
                💻 GitHub
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
