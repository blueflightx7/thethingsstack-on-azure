# Beehive Dashboard - Showroom Transformation Plan

> **Target Audience**: Microsoft customers, partners, executives in NYC showroom  
> **Display**: Large TV/Kiosk (touch-capable)  
> **Timeline**: A few days  
> **Branding**: Microsoft/Azure only (no BEEP/TTS branding)

---

## Research Summary: Scientifically-Backed Alert Thresholds

Based on BEEP documentation and scientific literature:

### Temperature Thresholds

| Metric | Optimal | Warning | Critical | Source |
|--------|---------|---------|----------|--------|
| **Brood Nest** | 34-35°C | <32°C or >37°C | <30°C or >40°C | Bee biology studies |
| **Winter Cluster** | 27-34°C | <25°C | <20°C (hypothermia) | BEEP/Wikipedia |
| **Ambient Hive** | 15-30°C | <10°C (no flight) | <5°C (emergency) | General apiculture |

### Weight Thresholds & Patterns

| Event | Pattern | Typical Values | Detection |
|-------|---------|----------------|-----------|
| **Swarm** | Sudden drop in <30 min | -1.5 to -2.5 kg | Drop rate >1kg/hour |
| **Robbery** | Linear decline during daylight | -0.5 to -2 kg/day | Consistent decline 8AM-6PM |
| **Nectar Flow** | Daily gain with night loss | +0.5 to +5 kg/day | Positive 24h delta |
| **Winter Consumption** | Gradual decline | -0.5 to -2 kg/month | Steady negative trend |
| **Starvation Risk** | Low total weight | <10 kg total | Threshold depends on hive type |
| **Good Foraging** | Morning dip, afternoon gain | Net positive by EOD | Pattern analysis |

### Sound/FFT Thresholds (BEEP Base: 71-583 Hz range)

| Frequency Range | Meaning | Alert Condition |
|-----------------|---------|-----------------|
| **71-173 Hz** (Low) | Normal brood activity | Baseline reference |
| **173-327 Hz** (Mid) | Foraging activity, ventilation | Normal variation |
| **327-480 Hz** (High-Mid) | Increased activity | Monitor if sustained |
| **480-583 Hz** (High) | Stress, aggression, swarming prep | Warning when elevated |
| **Queen Piping** | ~200-500 Hz distinct pattern | Pre-swarm indicator |
| **Silent/Flatline** | No activity | Critical - colony loss |

### Battery Thresholds

| Level | Percentage | Visual | Action |
|-------|------------|--------|--------|
| Good | >50% | Green | None |
| Warning | 20-50% | Yellow | Plan replacement |
| Critical | <20% | Red | Immediate attention |

---

## Phase Overview

| Phase | Name | Effort | Priority |
|-------|------|--------|----------|
| 1 | Foundation & Real-Time | 3-4 days | HIGH |
| 2 | Hive Management | 1 day | HIGH |
| 3 | Visual Design & Branding | 2-3 days | HIGH |
| 4 | Hero Visualizations | 2-3 days | MEDIUM |
| 5 | Audio System | 2 days | MEDIUM |
| 6 | Architecture Diagram | 1-2 days | MEDIUM |
| 7 | Kiosk Mode | 1 day | HIGH |
| 8 | Polish & Testing | 1-2 days | HIGH |

---

## Phase 1: Foundation & Real-Time Infrastructure

### 1.1 WebSocket Real-Time Updates

```typescript
// useRealtimeData.ts
- Azure Web PubSub integration (already deployed)
- WebSocket connection with auto-reconnect
- 30-second polling fallback
- Connection status indicator (user-friendly)
```

**User-Friendly Messages**:
- Connected: "Live data • Updated just now"
- Reconnecting: "Reconnecting to hive sensors..."
- Offline: "Working offline • Last update: 5 minutes ago"
- Polling mode: "Live updates unavailable • Refreshing every 30 seconds"

**Admin Messages** (tooltip/detailed):
- "WebSocket connected to wss://..."
- "Fallback: HTTP polling @ 30s interval"
- "Connection failed: Error code 1006"

### 1.2 Offline Support

```typescript
// useOfflineCache.ts
- IndexedDB for last known state
- Service worker for static assets
- Visual indicator when showing cached data
- Graceful degradation
```

### 1.3 Data Consolidation

- Merge duplicate `/api/overview` calls
- Single data fetch context
- Loading skeletons (not spinners)

---

## Phase 2: Hive Management

### 2.1 Hive Naming

**Database Update**:
```sql
ALTER TABLE [IoT].[Devices] ADD DisplayName NVARCHAR(100) NULL;
```

**API Update**:
```csharp
// New endpoint: PUT /api/devices/{deviceId}/name
public async Task<IActionResult> UpdateDeviceName(string deviceId, string displayName)
```

**UI Component**:
```typescript
// Inline edit on hive cards
<HiveNameEditor 
  deviceId="eui-xxx"
  displayName="Queen Elizabeth's Hive"  // User-friendly
  deviceEui="eui-xxx"                    // Admin view
  onSave={updateHiveName}
/>
```

**Display Rules**:
- If `displayName` exists → show `displayName`
- Else → show `deviceId` formatted nicely
- Admin view: Always show both

---

## Phase 3: Visual Design & Microsoft Branding

### 3.1 Color Palette

```typescript
// Azure-inspired palette
const azureColors = {
  // Primary
  azureBlue: '#0078D4',        // Primary actions
  azureDarkBlue: '#004578',    // Headers
  azureLightBlue: '#E6F2FA',   // Backgrounds
  
  // Status
  success: '#107C10',          // Good/healthy
  warning: '#FFB900',          // Warning
  critical: '#D13438',         // Critical/error
  info: '#0078D4',             // Information
  
  // Neutrals (Fluent)
  background: '#FAFAFA',
  surface: '#FFFFFF',
  textPrimary: '#323130',
  textSecondary: '#605E5C',
  
  // Dark theme
  darkBackground: '#1F1F1F',
  darkSurface: '#2D2D2D',
};
```

### 3.2 Branding Removal & Addition

**Remove**:
- BEEP logo/references
- The Things Stack branding
- Any third-party logos

**Add**:
- Microsoft logo (header corner)
- "Powered by Azure IoT" badge (footer)
- Azure icon set for status indicators

### 3.3 Map Component

**Option A: Keep Leaflet** (Current)
- Already working
- Style with Azure-inspired tiles
- Custom markers with Fluent design

**Option B: Azure Maps** (Recommended for Microsoft showroom)
```bash
npm install react-azure-maps azure-maps-control
```

Benefits:
- Native Azure integration
- Consistent Microsoft branding
- Indoor maps support
- Better enterprise features

**Implementation**:
```typescript
import { AzureMapsProvider, AzureMap, AzureMapDataSourceProvider } from 'react-azure-maps';

// Map with resizable container
<ResizableBox>
  <AzureMapsProvider>
    <AzureMap options={{ center: [lng, lat], zoom: 12 }}>
      <AzureMapDataSourceProvider>
        <HiveMarkers hives={hives} />
      </AzureMapDataSourceProvider>
    </AzureMap>
  </AzureMapsProvider>
</ResizableBox>
```

---

## Phase 4: Hero Visualizations

### 4.1 Temperature Display

```typescript
// Large animated temperature gauge
<TemperatureHero
  current={34.2}
  optimal={{ min: 34, max: 35 }}
  warning={{ min: 32, max: 37 }}
  unit="°C"
  showTrend={true}  // Arrow up/down/stable
/>
```

Visual: Circular gauge with gradient fill (green→yellow→red)

### 4.2 Weight Trend

```typescript
// Animated weight display with pattern detection
<WeightHero
  currentKg={42.5}
  change24h={+0.8}
  pattern="nectar-flow"  // detected pattern
  alerts={['Strong foraging activity detected']}
/>
```

Visual: Large number with sparkline, pattern badge

### 4.3 Alert Indicators

```typescript
// Alert thresholds from research
const alertConfig = {
  temperature: {
    brood: { optimal: [34, 35], warning: [32, 37], critical: [30, 40] },
    winter: { optimal: [27, 34], warning: [25, 35], critical: [20, 38] },
  },
  weight: {
    swarmDetection: { dropRateKgPerHour: 1.0 },
    robberyDetection: { declineKgPerDay: 0.5, sustainedHours: 4 },
    starvationRisk: { totalKg: 10 },
  },
  fft: {
    stressThreshold: { highFreqRatio: 0.6 },  // >60% in 480-583Hz
    silentThreshold: { totalEnergy: 10 },      // Near-zero activity
  },
  battery: { warning: 50, critical: 20 },
};
```

---

## Phase 5: Audio System

### 5.1 Audio Toggle Control

```typescript
type AudioMode = 'real' | 'synthesized' | 'off';

<AudioControl
  mode={audioMode}
  onChange={setAudioMode}
  isPlaying={isPlaying}
/>

// Three-state toggle:
// [🔇 Off] [🎵 Synthesized] [🎙️ Real] (if RTSP available)
```

### 5.2 Synthesized Audio (FFT → Sound)

```typescript
// Convert FFT bins to audio
const synthesizeFromFFT = (fftBins: number[], ctx: AudioContext) => {
  const oscillators = fftBins.map((amplitude, i) => {
    const freq = 71 + (i * 51.2);  // BEEP Base frequency bins
    const osc = ctx.createOscillator();
    osc.frequency.value = freq;
    osc.type = 'sine';
    
    const gain = ctx.createGain();
    gain.gain.value = amplitude / 100;  // Normalize
    
    osc.connect(gain).connect(ctx.destination);
    return { osc, gain };
  });
  
  return oscillators;
};
```

### 5.3 Audio Waveform Visualization

```typescript
// Real-time waveform display
<AudioWaveform
  isPlaying={isPlaying}
  fftData={currentFFT}
  height={60}
  color={azureColors.azureBlue}
  style="bars"  // or 'wave', 'circular'
/>
```

### 5.4 Real Audio (RTSP-style) - Planned

```typescript
// Future: Stream from device microphone
<RealAudioStream
  deviceId={selectedHive}
  enabled={audioMode === 'real'}
  fallback={<SynthesizedAudio fft={fftData} />}
/>
```

Note: Requires additional infrastructure (audio streaming service)

---

## Phase 6: Architecture Diagram

### 6.1 Three Views

```typescript
type ArchitectureView = 'current' | 'planned' | 'future';

<ArchitectureDiagram
  view={view}
  interactive={true}
  animated={view !== 'current'}
/>
```

### 6.2 Current Architecture (Static with Hover)

```
┌─────────────────────────────────────────────────────────────────┐
│                    BEEP Base Sensor                             │
│                    (LoRaWAN Device)                             │
└────────────────────────┬────────────────────────────────────────┘
                         │ LoRaWAN
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              The Things Stack (Network Server)                  │
│                    [Azure VM]                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │ Webhook
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Azure IoT Hub                                │
└────────────────────────┬────────────────────────────────────────┘
                         │ Event Hub
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Azure Functions (ProcessToSQL)                     │
└────────────────────────┬────────────────────────────────────────┘
                         │ SQL Insert
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Azure SQL Database                              │
└────────────────────────┬────────────────────────────────────────┘
                         │ REST API
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Azure Static Web App                               │
│                   (Dashboard)                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Hover Effects**:
- Highlight box on hover
- Show component details tooltip
- Animate data flow path

### 6.3 Planned Architecture (Animated)

Additions:
- Azure Web PubSub (real-time) - animated pulse
- Azure SignalR fallback
- Caching layer

### 6.4 Future Vision (Interactive)

Additions:
- Azure Digital Twins (3D hive model)
- Machine Learning (anomaly detection)
- Power BI integration
- Mobile app

---

## Phase 7: Kiosk Mode

### 7.1 Fullscreen Toggle

```typescript
// Kiosk mode features
<KioskModeProvider>
  <Dashboard
    fullscreen={true}
    autoHideCursor={true}
    preventScreensaver={true}
  />
</KioskModeProvider>
```

### 7.2 Auto-Cycle Views

```typescript
const cycleConfig = {
  enabled: true,
  interval: 30000,  // 30 seconds
  views: ['overview', 'map', 'hive-detail', 'architecture'],
  pauseOnInteraction: true,
};

<AutoCycleController config={cycleConfig}>
  <DashboardViews />
</AutoCycleController>
```

### 7.3 Touch Optimization

- Larger tap targets (min 48px)
- Swipe gestures for navigation
- Pinch-to-zoom on map
- Pull-to-refresh

---

## Phase 8: Final Polish

### 8.1 GitHub Integration

```typescript
// Footer component
<Footer>
  <span>Powered by Azure IoT</span>
  <a href="https://github.com/kartben/thethingsstack-on-azure">
    <GitHubIcon /> View on GitHub
  </a>
</Footer>
```

### 8.2 Admin vs Public Views

```typescript
// Route protection already in place
// Enhance with role-based content

// Public view (default)
- Friendly hive names
- Simplified alerts
- No technical IDs

// Admin view (/admin)
- Device EUIs
- Raw data values
- Deployment logs
- System health
```

### 8.3 Performance

- Image optimization (next/image)
- Code splitting per route
- Prefetch on hover
- <100ms interaction response

### 8.4 Accessibility

- WCAG 2.1 AA compliance
- Screen reader support
- Keyboard navigation
- High contrast mode support

---

## Decision Points for You

Before we proceed, please confirm:

### 1. Phase Priority
Which phases are most critical for the demo?
- [ ] Real-time updates (Phase 1)
- [ ] Hive naming (Phase 2)
- [ ] Visual redesign (Phase 3)
- [ ] Audio (Phase 5)
- [ ] Kiosk mode (Phase 7)

### 2. Map Technology
- [ ] **Keep Leaflet** - Faster, already working
- [ ] **Migrate to Azure Maps** - Better Microsoft alignment

### 3. Audio Source Priority
- [ ] **Synthesized only** - Simpler, always works
- [ ] **Real + Synthesized** - More complex, needs RTSP

### 4. Architecture Diagram Style
- [ ] **SVG-based** - Custom, animated
- [ ] **Mermaid/Diagrams** - Easier to maintain
- [ ] **Image with hotspots** - Simplest

### 5. Hive Naming Convention
Examples for demo:
- [ ] "Queen Victoria's Hive", "The Honeymooners"
- [ ] "Hive Alpha", "Hive Bravo"
- [ ] "Rooftop NYC #1", "Rooftop NYC #2"
- [ ] Custom names you provide

### 6. Alert Threshold Defaults
Use thresholds from research above?
- [ ] Yes, implement all
- [ ] Yes, but adjust values: ___
- [ ] Start simple, add later

---

## Files to Create/Modify

### New Files
```
dashboard/src/app/
├── hooks/
│   ├── useRealtimeData.ts      # WebSocket + polling
│   ├── useOfflineCache.ts      # IndexedDB caching
│   └── useAudioPlayer.ts       # FFT → audio
├── components/
│   ├── hero/
│   │   ├── TemperatureHero.tsx
│   │   ├── WeightHero.tsx
│   │   └── AlertBadge.tsx
│   ├── audio/
│   │   ├── AudioControl.tsx
│   │   └── AudioWaveform.tsx
│   ├── architecture/
│   │   └── ArchitectureDiagram.tsx (replace placeholder)
│   ├── kiosk/
│   │   ├── KioskModeProvider.tsx
│   │   └── AutoCycleController.tsx
│   └── common/
│       ├── HiveNameEditor.tsx
│       └── ConnectionStatus.tsx
├── styles/
│   └── azure-theme.ts          # Color palette
└── lib/
    └── alert-thresholds.ts     # Threshold configs
```

### Modified Files
```
dashboard/src/app/
├── providers.tsx               # Add new contexts
├── HomeClient.tsx              # Hero sections
├── components/
│   ├── DashboardHeader.tsx     # Audio toggle, branding
│   ├── HiveDetailPanel.tsx     # Hive naming
│   ├── HiveMap.tsx            # Azure Maps (optional)
│   └── Footer.tsx             # GitHub link
└── globals.css                # Azure theme
```

### Backend Updates
```
deployments/integration/
├── function/
│   ├── ProcessToSQL/run.csx   # Web PubSub broadcast
│   └── UpdateDeviceName/      # New endpoint
└── sql/
    └── schema.sql             # DisplayName column
```

---

## Ready to Proceed?

Reply with:
1. **Your phase priority** (which ones first?)
2. **Decisions** on the 6 items above
3. Any **custom hive names** for the demo
4. **"Go"** to start implementation

I'll implement in batches, deploying incrementally so you can see progress.
