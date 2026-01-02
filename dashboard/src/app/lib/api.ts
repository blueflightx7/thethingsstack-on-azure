export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export type OverviewHive = {
  deviceId: number;
  devEui: string;
  hiveIdentity?: string | null;
  hiveName: string;
  lastSeenAt?: string | null;
  lastMeasurementAt?: string | null;
  gatewayIdentifier?: string | null;
  location?: { label?: string | null; latitude?: number | null; longitude?: number | null };
  telemetry?: {
    temperatureInner?: number | null;
    temperatureOuter?: number | null;
    humidity?: number | null;
    weightKg?: number | null;
    batteryVoltage?: number | null;
    batteryPercent?: number | null;
    soundEnergyTotal?: number | null;
    soundDominantBinRange?: string | null;
  };
};

export type OverviewResponse = {
  activeDevices: number;
  messagesToday: number;
  gatewaysOnline: number;
  systemStatus: string;
  lastUpdated?: string;
  hives: OverviewHive[];
};

export type HiveDetailResponse = {
  deviceId: number;
  devEui: string;
  hiveIdentity: string;
  hiveName?: string | null;
  lastSeenAt?: string | null;
  lastMeasurementAt?: string | null;
  gatewayIdentifier?: string | null;
  location?: { label?: string | null; latitude?: number | null; longitude?: number | null };
  telemetry?: {
    temperatureInner?: number | null;
    temperatureOuter?: number | null;
    humidity?: number | null;
    weightKg?: number | null;
    batteryVoltage?: number | null;
    batteryPercent?: number | null;
    soundFrequency?: number | null;
    soundEnergyTotal?: number | null;
    soundEnergyLow?: number | null;
    soundEnergyMid?: number | null;
    soundEnergyHigh?: number | null;
    soundDominantBin?: number | null;
    soundDominantBinRange?: string | null;
    rssi?: number | null;
    snr?: number | null;
  };
};

export type HiveSeriesPoint = {
  timestamp: string;
  temperatureInner?: number | null;
  temperatureOuter?: number | null;
  humidity?: number | null;
  weightKg?: number | null;
  batteryVoltage?: number | null;
  batteryPercent?: number | null;
  soundFrequency?: number | null;
  soundEnergyTotal?: number | null;
  soundEnergyLow?: number | null;
  soundEnergyMid?: number | null;
  soundEnergyHigh?: number | null;
  rssi?: number | null;
  snr?: number | null;
  fft?: Record<string, number | null | undefined>;
};

export type HiveSeriesResponse = {
  hiveIdentity: string;
  minutes: number;
  points: HiveSeriesPoint[];
};

export type RealtimeResponse = {
  windowMinutes: number;
  points: Array<{ timestamp: string; count: number }>;
  lastMessageAt: string | null;
  messagesLastMinute: number;
};

export type AuthMeResponse = {
  clientPrincipal?: {
    userId: string;
    userDetails: string;
    identityProvider: string;
    userRoles: string[];
  };
};
