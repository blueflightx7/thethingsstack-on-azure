export function formatMaybeNumber(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return '—';
  return Number(value).toFixed(digits);
}

export function formatMaybeInt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return String(Math.trunc(value));
}

export function formatTimestamp(ts: string | Date | null | undefined): string {
  if (!ts) return '—';
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export function ageLabel(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return '—';
  const d = new Date(isoTimestamp);
  const ms = Date.now() - d.getTime();
  if (!Number.isFinite(ms)) return '—';
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function freshnessKind(isoTimestamp: string | null | undefined): 'good' | 'warning' | 'critical' {
  if (!isoTimestamp) return 'critical';
  const d = new Date(isoTimestamp);
  const ms = Date.now() - d.getTime();
  const minutes = ms / 60000;
  if (!Number.isFinite(minutes)) return 'critical';
  if (minutes <= 5) return 'good';
  if (minutes <= 30) return 'warning';
  return 'critical';
}
