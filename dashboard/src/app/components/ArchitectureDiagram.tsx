'use client';

import { useState } from 'react';
import {
  makeStyles,
  shorthands,
} from '@griffel/react';
import {
  Title2,
  Text,
} from '@fluentui/react-text';
import {
  Card,
} from '@fluentui/react-card';
import { tokens } from '@fluentui/react-theme';
import { Tooltip } from '@fluentui/react-tooltip';

const useStyles = makeStyles({
  container: {
    ...shorthands.padding('24px'),
    backgroundColor: tokens.colorNeutralBackground2,
    minHeight: '100%',
  },
  card: {
    ...shorthands.padding('24px'),
    backgroundColor: tokens.colorNeutralBackground1,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    boxShadow: tokens.shadow8,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  subtitle: {
    color: tokens.colorNeutralForeground3,
  },
  diagramContainer: {
    display: 'flex',
    justifyContent: 'center',
    ...shorthands.padding('20px'),
    overflowX: 'auto',
  },
  svg: {
    maxWidth: '100%',
    height: 'auto',
  },
});

interface ComponentInfo {
  id: string;
  name: string;
  description: string;
  technology: string;
  details: string[];
}

const componentData: Record<string, ComponentInfo> = {
  sensor: {
    id: 'sensor',
    name: 'BEEP Base Sensor',
    description: 'LoRaWAN-enabled beehive monitoring sensor',
    technology: 'LoRaWAN Class A Device',
    details: [
      'Temperature (inner/outer)',
      'Humidity monitoring',
      'Weight scale (load cells)',
      'FFT audio analysis',
      'Battery monitoring',
    ],
  },
  tts: {
    id: 'tts',
    name: 'The Things Stack',
    description: 'LoRaWAN Network Server for device management',
    technology: 'Azure VM (Docker)',
    details: [
      'Device registration & management',
      'Uplink/downlink processing',
      'Payload decoding',
      'Webhook integration',
    ],
  },
  iothub: {
    id: 'iothub',
    name: 'Azure IoT Hub',
    description: 'Cloud gateway for IoT device communication',
    technology: 'Azure IoT Hub (S1)',
    details: [
      'Device identity management',
      'Message routing',
      'Cloud-to-device messaging',
      'Built-in Event Hub endpoint',
    ],
  },
  functions: {
    id: 'functions',
    name: 'Azure Functions',
    description: 'Serverless compute for data processing',
    technology: 'Azure Functions (.NET 8)',
    details: [
      'ProcessToSQL - Store telemetry',
      'GetOverview - Dashboard API',
      'GetHiveDetail - Hive data API',
      'Real-time broadcast (planned)',
    ],
  },
  sql: {
    id: 'sql',
    name: 'Azure SQL Database',
    description: 'Relational database for telemetry storage',
    technology: 'Azure SQL (Basic tier)',
    details: [
      'Devices table',
      'Telemetry table',
      'Time-series queries',
      'Aggregation views',
    ],
  },
  pubsub: {
    id: 'pubsub',
    name: 'Azure Web PubSub',
    description: 'Real-time messaging service',
    technology: 'Azure Web PubSub (Free tier)',
    details: [
      'WebSocket connections',
      'Real-time dashboard updates',
      'Push notifications',
      'Scalable messaging',
    ],
  },
  swa: {
    id: 'swa',
    name: 'Azure Static Web Apps',
    description: 'Hosting for the dashboard application',
    technology: 'Azure Static Web Apps + AAD',
    details: [
      'Next.js static export',
      'Azure AD authentication',
      'API proxying',
      'Global CDN distribution',
    ],
  },
};

export const ArchitectureDiagram = () => {
  const styles = useStyles();
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);

  const getBoxFill = (id: string) => {
    if (selectedComponent === id) return '#0078D4';
    if (hoveredComponent === id) return '#E6F2FA';
    return '#FFFFFF';
  };

  const getTextFill = (id: string) => {
    if (selectedComponent === id) return '#FFFFFF';
    return '#323130';
  };

  const getStroke = (id: string) => {
    if (selectedComponent === id || hoveredComponent === id) return '#0078D4';
    return '#D1D1D1';
  };

  const renderTooltipContent = (info: ComponentInfo) => (
    <div style={{ maxWidth: '280px' }}>
      <Text weight="semibold" block>{info.name}</Text>
      <Text size={200} style={{ color: '#0078D4' }} block>{info.technology}</Text>
      <Text size={200} block style={{ marginTop: '8px' }}>{info.description}</Text>
      <ul style={{ margin: '8px 0 0 0', paddingLeft: '16px', fontSize: '12px' }}>
        {info.details.map((detail, i) => (
          <li key={i}>{detail}</li>
        ))}
      </ul>
    </div>
  );

  const ComponentBox = ({ 
    id, 
    x, 
    y, 
    width = 200, 
    height = 60,
    label,
    sublabel,
  }: { 
    id: string; 
    x: number; 
    y: number; 
    width?: number; 
    height?: number;
    label: string;
    sublabel?: string;
  }) => {
    const info = componentData[id];
    
    const box = (
      <g
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setHoveredComponent(id)}
        onMouseLeave={() => setHoveredComponent(null)}
        onClick={() => setSelectedComponent(selectedComponent === id ? null : id)}
      >
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={6}
          ry={6}
          fill={getBoxFill(id)}
          stroke={getStroke(id)}
          strokeWidth={hoveredComponent === id || selectedComponent === id ? 2 : 1}
          style={{ transition: 'all 0.2s ease' }}
        />
        <text
          x={x + width / 2}
          y={y + (sublabel ? height / 2 - 6 : height / 2 + 5)}
          textAnchor="middle"
          fill={getTextFill(id)}
          fontSize={14}
          fontWeight={600}
          fontFamily="Segoe UI, sans-serif"
        >
          {label}
        </text>
        {sublabel && (
          <text
            x={x + width / 2}
            y={y + height / 2 + 12}
            textAnchor="middle"
            fill={selectedComponent === id ? '#B3D7F2' : '#605E5C'}
            fontSize={11}
            fontFamily="Segoe UI, sans-serif"
          >
            {sublabel}
          </text>
        )}
      </g>
    );

    if (info) {
      return (
        <Tooltip
          content={renderTooltipContent(info)}
          relationship="description"
          positioning="above"
        >
          {box}
        </Tooltip>
      );
    }

    return box;
  };

  // Arrow component
  const Arrow = ({ 
    x1, y1, x2, y2, 
    label,
    highlight = false,
  }: { 
    x1: number; y1: number; x2: number; y2: number; 
    label?: string;
    highlight?: boolean;
  }) => {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const isHighlight = highlight || hoveredComponent != null;
    
    return (
      <g>
        <defs>
          <marker
            id={`arrow-${x1}-${y1}`}
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill={isHighlight ? '#0078D4' : '#A19F9D'} />
          </marker>
        </defs>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={isHighlight ? '#0078D4' : '#A19F9D'}
          strokeWidth={isHighlight ? 2 : 1.5}
          strokeDasharray={isHighlight ? 'none' : '5,3'}
          markerEnd={`url(#arrow-${x1}-${y1})`}
          style={{ transition: 'all 0.2s ease' }}
        />
        {label && (
          <text
            x={midX + 10}
            y={midY}
            fill="#605E5C"
            fontSize={10}
            fontFamily="Segoe UI, sans-serif"
          >
            {label}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <div className={styles.header}>
          <div>
            <Title2>System Architecture</Title2>
            <Text className={styles.subtitle}>
              Azure IoT Beehive Monitoring Platform
            </Text>
          </div>
          <Text size={200} className={styles.subtitle}>
            Hover over components for details
          </Text>
        </div>

        <div className={styles.diagramContainer}>
          <svg 
            width="800" 
            height="600" 
            viewBox="0 0 800 600"
            className={styles.svg}
          >
            {/* Background grid */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#F3F2F1" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Section labels */}
            <text x="400" y="30" textAnchor="middle" fill="#605E5C" fontSize={12} fontFamily="Segoe UI, sans-serif">
              Edge / Device Layer
            </text>
            <text x="400" y="180" textAnchor="middle" fill="#605E5C" fontSize={12} fontFamily="Segoe UI, sans-serif">
              Azure Cloud
            </text>

            {/* Divider line */}
            <line x1="50" y1="140" x2="750" y2="140" stroke="#E1DFDD" strokeWidth="1" strokeDasharray="4,4" />

            {/* BEEP Base Sensor */}
            <ComponentBox
              id="sensor"
              x={300}
              y={50}
              label="BEEP Base Sensor"
              sublabel="LoRaWAN Device"
            />

            {/* The Things Stack */}
            <ComponentBox
              id="tts"
              x={300}
              y={200}
              label="The Things Stack"
              sublabel="Network Server"
            />

            {/* Azure IoT Hub */}
            <ComponentBox
              id="iothub"
              x={300}
              y={300}
              label="Azure IoT Hub"
              sublabel="Cloud Gateway"
            />

            {/* Azure Functions */}
            <ComponentBox
              id="functions"
              x={100}
              y={400}
              label="Azure Functions"
              sublabel="Data Processing"
            />

            {/* Azure SQL */}
            <ComponentBox
              id="sql"
              x={100}
              y={500}
              label="Azure SQL Database"
              sublabel="Telemetry Storage"
            />

            {/* Azure Web PubSub */}
            <ComponentBox
              id="pubsub"
              x={500}
              y={400}
              label="Azure Web PubSub"
              sublabel="Real-time Messaging"
            />

            {/* Azure Static Web Apps */}
            <ComponentBox
              id="swa"
              x={500}
              y={500}
              width={200}
              label="Static Web Apps"
              sublabel="Dashboard + Auth"
            />

            {/* Arrows - Data flow */}
            <Arrow x1={400} y1={110} x2={400} y2={195} label="LoRaWAN" highlight={hoveredComponent === 'sensor' || hoveredComponent === 'tts'} />
            <Arrow x1={400} y1={260} x2={400} y2={295} label="Webhook" highlight={hoveredComponent === 'tts' || hoveredComponent === 'iothub'} />
            <Arrow x1={300} y1={350} x2={200} y2={395} label="Event Hub" highlight={hoveredComponent === 'iothub' || hoveredComponent === 'functions'} />
            <Arrow x1={200} y1={460} x2={200} y2={495} label="SQL Insert" highlight={hoveredComponent === 'functions' || hoveredComponent === 'sql'} />
            <Arrow x1={300} y1={530} x2={495} y2={530} label="REST API" highlight={hoveredComponent === 'sql' || hoveredComponent === 'swa'} />
            <Arrow x1={500} y1={450} x2={500} y2={495} label="WebSocket" highlight={hoveredComponent === 'pubsub' || hoveredComponent === 'swa'} />
            <Arrow x1={300} y1={430} x2={495} y2={430} label="Broadcast" highlight={hoveredComponent === 'functions' || hoveredComponent === 'pubsub'} />

            {/* Azure branding */}
            <g transform="translate(680, 560)">
              <text fill="#0078D4" fontSize={11} fontWeight={600} fontFamily="Segoe UI, sans-serif">
                Powered by Azure
              </text>
            </g>
          </svg>
        </div>

        {selectedComponent && componentData[selectedComponent] && (
          <Card style={{ marginTop: '16px', padding: '16px', backgroundColor: '#F3F2F1' }}>
            <Text weight="semibold" size={400}>{componentData[selectedComponent].name}</Text>
            <Text block style={{ color: '#0078D4', marginBottom: '8px' }}>
              {componentData[selectedComponent].technology}
            </Text>
            <Text block>{componentData[selectedComponent].description}</Text>
            <div style={{ marginTop: '12px' }}>
              <Text weight="semibold" size={200}>Capabilities:</Text>
              <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
                {componentData[selectedComponent].details.map((detail, i) => (
                  <li key={i}><Text size={200}>{detail}</Text></li>
                ))}
              </ul>
            </div>
          </Card>
        )}
      </Card>
    </div>
  );
};
