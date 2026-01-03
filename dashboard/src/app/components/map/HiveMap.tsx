'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { makeStyles, shorthands } from '@griffel/react';
import { tokens } from '@fluentui/react-theme';
import { Text } from '@fluentui/react-text';
import { Spinner } from '@fluentui/react-spinner';

const useStyles = makeStyles({
  container: {
    position: 'relative',
    width: '100%',
    height: '400px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    ...shorthands.overflow('hidden'),
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loading: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
  noData: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
  legend: {
    position: 'absolute',
    bottom: '16px',
    right: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    ...shorthands.padding('8px', '12px'),
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow8,
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('4px'),
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('6px'),
    fontSize: tokens.fontSizeBase200,
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
});

export interface HiveLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status?: 'healthy' | 'warning' | 'critical';
  lastSeen?: string | null;
  temperatureC?: number | null;
  weightKg?: number | null;
}

interface HiveMapProps {
  hives: HiveLocation[];
  selectedHiveId?: string | null;
  onHiveSelect?: (hiveId: string) => void;
  loading?: boolean;
  height?: string;
}

// Status colors matching our alert system
const statusColors = {
  healthy: '#107C10',
  warning: '#FFB900',
  critical: '#D13438',
  default: '#0078D4',
};

// Leaflet CSS CDN URL
const LEAFLET_CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

// Load Leaflet CSS dynamically
function loadLeafletCSS(): Promise<void> {
  return new Promise((resolve) => {
    // Check if already loaded
    if (document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`)) {
      resolve();
      return;
    }
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = LEAFLET_CSS_URL;
    link.onload = () => resolve();
    link.onerror = () => resolve(); // Continue even if CSS fails
    document.head.appendChild(link);
  });
}

export function HiveMap({
  hives,
  selectedHiveId,
  onHiveSelect,
  loading = false,
  height = '400px',
}: HiveMapProps) {
  const styles = useStyles();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // Calculate center from hives or default to NYC
  const center = useMemo(() => {
    if (hives.length === 0) {
      return { lat: 40.7589, lng: -73.9851 }; // NYC default (Microsoft office area)
    }
    const avgLat = hives.reduce((sum, h) => sum + h.latitude, 0) / hives.length;
    const avgLng = hives.reduce((sum, h) => sum + h.longitude, 0) / hives.length;
    return { lat: avgLat, lng: avgLng };
  }, [hives]);

  useEffect(() => {
    // Dynamic import of Leaflet (client-side only)
    const initMap = async () => {
      if (!mapContainerRef.current || mapRef.current) return;

      // Load Leaflet CSS first
      await loadLeafletCSS();

      // Dynamic import of Leaflet
      const L = await import('leaflet');

      // Fix Leaflet default icon issue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Create map
      const map = L.map(mapContainerRef.current, {
        center: [center.lat, center.lng],
        zoom: hives.length === 1 ? 15 : 12,
        zoomControl: true,
        attributionControl: true,
      });

      // Add tile layer (using OpenStreetMap)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when hives change or map becomes ready
  useEffect(() => {
    const updateMarkersAsync = async () => {
      if (!mapRef.current || !mapReady) return;
      
      const L = await import('leaflet');
      
      // Clear existing markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      // Add new markers
      hives.forEach(hive => {
        const color = statusColors[hive.status || 'default'] || statusColors.default;
        const isSelected = hive.id === selectedHiveId;

        // Create custom icon
        const icon = L.divIcon({
          className: 'custom-hive-marker',
          html: `
            <div style="
              width: ${isSelected ? '24px' : '20px'};
              height: ${isSelected ? '24px' : '20px'};
              background-color: ${color};
              border: 3px solid ${isSelected ? '#fff' : 'rgba(255,255,255,0.8)'};
              border-radius: 50%;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              transition: all 0.2s ease;
            ">
              🐝
            </div>
          `,
          iconSize: [isSelected ? 30 : 26, isSelected ? 30 : 26],
          iconAnchor: [isSelected ? 15 : 13, isSelected ? 15 : 13],
        });

        const marker = L.marker([hive.latitude, hive.longitude], { icon })
          .addTo(mapRef.current)
          .bindPopup(`
            <div style="min-width: 150px;">
              <strong style="font-size: 14px;">${hive.name}</strong>
              <div style="margin-top: 8px; font-size: 12px; color: #666;">
                ${hive.temperatureC != null ? `🌡️ ${hive.temperatureC.toFixed(1)}°C` : ''}
                ${hive.weightKg != null ? `<br/>⚖️ ${hive.weightKg.toFixed(1)} kg` : ''}
                ${hive.lastSeen ? `<br/>🕐 ${new Date(hive.lastSeen).toLocaleString()}` : ''}
              </div>
            </div>
          `);

        if (onHiveSelect) {
          marker.on('click', () => onHiveSelect(hive.id));
        }

        markersRef.current.push(marker);
      });

      // Fit bounds if multiple hives
      if (hives.length > 1) {
        const bounds = L.latLngBounds(hives.map(h => [h.latitude, h.longitude]));
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      } else if (hives.length === 1) {
        mapRef.current.setView([hives[0].latitude, hives[0].longitude], 15);
      }
    };
    
    updateMarkersAsync();
  }, [hives, selectedHiveId, mapReady, onHiveSelect]);

  return (
    <div className={styles.container} style={{ height }}>
      <div ref={mapContainerRef} className={styles.map} />
      
      {loading && (
        <div className={styles.loading}>
          <Spinner size="medium" />
          <Text size={200}>Loading map...</Text>
        </div>
      )}
      
      {!loading && hives.length === 0 && (
        <div className={styles.noData}>
          <Text size={300}>No hive locations available</Text>
          <Text size={200}>Hives will appear here once they report GPS coordinates</Text>
        </div>
      )}

      {hives.length > 0 && (
        <div className={styles.legend}>
          <Text size={200} weight="semibold">Hive Status</Text>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ backgroundColor: statusColors.healthy }} />
            <span>Healthy</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ backgroundColor: statusColors.warning }} />
            <span>Warning</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ backgroundColor: statusColors.critical }} />
            <span>Critical</span>
          </div>
        </div>
      )}
    </div>
  );
}
