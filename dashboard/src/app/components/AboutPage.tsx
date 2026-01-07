'use client';

import { makeStyles, shorthands } from '@griffel/react';
import { tokens } from '@fluentui/react-theme';
import { Text, Title1, Title2, Title3 } from '@fluentui/react-text';
import { Card } from '@fluentui/react-card';
import { 
  LeafOne20Regular,
  Cloud20Regular,
  DataUsage20Regular,
  Globe20Regular,
  Heart20Regular,
  Lightbulb20Regular,
} from '@fluentui/react-icons';

const useStyles = makeStyles({
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    ...shorthands.padding('24px'),
  },
  hero: {
    textAlign: 'center',
    ...shorthands.padding('48px', '32px'),
    background: 'linear-gradient(135deg, #0078D4 0%, #004578 100%)',
    borderRadius: tokens.borderRadiusXLarge,
    marginBottom: '48px',
    color: 'white',
  },
  heroTitle: {
    color: 'white',
    marginBottom: '24px',
    fontSize: '32px',
    fontWeight: 700,
    display: 'block',
  },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '18px',
    maxWidth: '700px',
    margin: '0 auto',
    lineHeight: 1.6,
    display: 'block',
    marginTop: '8px',
  },
  section: {
    marginBottom: '48px',
  },
  sectionTitle: {
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
  },
  sectionIcon: {
    color: tokens.colorBrandForeground1,
    fontSize: '24px',
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    ...shorthands.gap('24px'),
  },
  card: {
    ...shorthands.padding('24px'),
    backgroundColor: tokens.colorNeutralBackground1,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    boxShadow: tokens.shadow4,
    borderRadius: tokens.borderRadiusLarge,
    height: '100%',
  },
  cardIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #0078D4 0%, #004578 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
    fontSize: '28px',
  },
  cardTitle: {
    marginBottom: '16px',
    fontSize: '18px',
    fontWeight: 600,
  },
  cardText: {
    color: tokens.colorNeutralForeground2,
    lineHeight: 1.7,
    fontSize: '14px',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    ...shorthands.gap('20px'),
    marginBottom: '48px',
    '@media (max-width: 900px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
    '@media (max-width: 500px)': {
      gridTemplateColumns: '1fr',
    },
  },
  statCard: {
    textAlign: 'center',
    ...shorthands.padding('24px', '16px'),
    backgroundColor: tokens.colorNeutralBackground1,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
  },
  statNumber: {
    fontSize: '42px',
    fontWeight: 700,
    color: '#0078D4',
    lineHeight: 1.1,
    marginBottom: '8px',
  },
  statLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: '13px',
    lineHeight: 1.4,
  },
  architectureImage: {
    width: '100%',
    maxWidth: '800px',
    margin: '0 auto',
    display: 'block',
  },
  timeline: {
    position: 'relative',
    ...shorthands.padding('0', '0', '0', '32px'),
    borderLeft: `3px solid #0078D4`,
    marginLeft: '8px',
  },
  timelineItem: {
    position: 'relative',
    ...shorthands.padding('0', '0', '32px', '24px'),
    ':last-child': {
      paddingBottom: 0,
    },
  },
  timelineDot: {
    position: 'absolute',
    left: '-42px',
    top: '4px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#0078D4',
    border: '3px solid white',
    boxShadow: tokens.shadow4,
  },
  timelineTitle: {
    fontWeight: 600,
    marginBottom: '8px',
    fontSize: '16px',
    color: tokens.colorNeutralForeground1,
  },
  timelineText: {
    color: tokens.colorNeutralForeground2,
    lineHeight: 1.6,
    fontSize: '14px',
  },
  quote: {
    ...shorthands.padding('28px', '32px'),
    backgroundColor: tokens.colorNeutralBackground3,
    borderLeft: `4px solid #0078D4`,
    borderRadius: tokens.borderRadiusMedium,
    fontStyle: 'italic',
    fontSize: '17px',
    color: tokens.colorNeutralForeground2,
    marginBottom: '48px',
    lineHeight: 1.7,
  },
  quoteAuthor: {
    marginTop: '16px',
    fontStyle: 'normal',
    fontWeight: 600,
    color: tokens.colorNeutralForeground1,
    fontSize: '14px',
  },
  beeEmoji: {
    fontSize: '56px',
    marginBottom: '20px',
  },
  linkList: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('12px'),
    '& a': {
      color: '#0078D4',
      textDecoration: 'none',
      fontWeight: 500,
      ':hover': {
        textDecoration: 'underline',
      },
    },
  },
});

export function AboutPage() {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <div className={styles.hero}>
        <div className={styles.beeEmoji}>🐝</div>
        <Title1 className={styles.heroTitle}>
          Beehive Monitoring & Microsoft Sustainability
        </Title1>
        <Text className={styles.heroSubtitle}>
          How IoT technology and cloud computing are helping protect pollinators
          and support biodiversity at Microsoft campuses worldwide.
        </Text>
      </div>

      {/* Stats Section */}
      <div className={styles.stats}>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>75%</div>
          <Text className={styles.statLabel}>of food crops need pollinators</Text>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>40%</div>
          <Text className={styles.statLabel}>decline in bee populations</Text>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>$235B</div>
          <Text className={styles.statLabel}>annual value of pollination</Text>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>24/7</div>
          <Text className={styles.statLabel}>continuous monitoring</Text>
        </div>
      </div>

      {/* Quote */}
      <div className={styles.quote}>
        "By 2030, Microsoft will be carbon negative, water positive, and zero waste. 
        Our beehive monitoring program is part of our broader commitment to protecting 
        biodiversity and the ecosystems that sustain us all."
        <div className={styles.quoteAuthor}>— Microsoft Environmental Sustainability Report</div>
      </div>

      {/* Why Bees Matter */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <Heart20Regular className={styles.sectionIcon} />
          <Title2>Why Bees Matter</Title2>
        </div>
        <div className={styles.cardGrid}>
          <Card className={styles.card}>
            <div className={styles.cardIcon}>🌸</div>
            <Title3 className={styles.cardTitle}>Pollination</Title3>
            <Text className={styles.cardText}>
              Bees pollinate approximately 80% of flowering plants and are responsible 
              for one out of every three bites of food we eat. Without bees, many crops 
              would fail, threatening global food security.
            </Text>
          </Card>
          <Card className={styles.card}>
            <div className={styles.cardIcon}>🌍</div>
            <Title3 className={styles.cardTitle}>Ecosystem Health</Title3>
            <Text className={styles.cardText}>
              Bees are indicator species for ecosystem health. A thriving bee population 
              indicates a healthy environment with low pollution and diverse plant life. 
              Monitoring bees helps us understand environmental changes.
            </Text>
          </Card>
          <Card className={styles.card}>
            <div className={styles.cardIcon}>📉</div>
            <Title3 className={styles.cardTitle}>The Crisis</Title3>
            <Text className={styles.cardText}>
              Colony Collapse Disorder, pesticides, habitat loss, and climate change 
              have caused dramatic declines in bee populations. Technology can help us 
              understand and address these threats.
            </Text>
          </Card>
        </div>
      </section>

      {/* The Technology */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <Cloud20Regular className={styles.sectionIcon} />
          <Title2>The Technology Stack</Title2>
        </div>
        <div className={styles.cardGrid}>
          <Card className={styles.card}>
            <div className={styles.cardIcon}>📡</div>
            <Title3 className={styles.cardTitle}>LoRaWAN Sensors</Title3>
            <Text className={styles.cardText}>
              Low-power, long-range sensors inside each hive measure temperature, 
              humidity, weight, and acoustic patterns. LoRaWAN technology allows 
              data transmission over miles with minimal battery usage.
            </Text>
          </Card>
          <Card className={styles.card}>
            <div className={styles.cardIcon}>☁️</div>
            <Title3 className={styles.cardTitle}>Azure Cloud</Title3>
            <Text className={styles.cardText}>
              The Things Stack on Azure receives sensor data via LoRaWAN gateways. 
              Azure Functions process data in real-time, while Azure SQL stores 
              historical records for analysis and machine learning.
            </Text>
          </Card>
          <Card className={styles.card}>
            <div className={styles.cardIcon}>🤖</div>
            <Title3 className={styles.cardTitle}>AI Insights</Title3>
            <Text className={styles.cardText}>
              Machine learning models analyze patterns to predict swarming events, 
              detect queen issues, identify diseases, and optimize hive management. 
              Early warnings help beekeepers take preventive action.
            </Text>
          </Card>
        </div>
      </section>

      {/* What We Monitor */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <DataUsage20Regular className={styles.sectionIcon} />
          <Title2>What We Monitor</Title2>
        </div>
        <div className={styles.cardGrid}>
          <Card className={styles.card}>
            <div className={styles.cardIcon}>🌡️</div>
            <Title3 className={styles.cardTitle}>Temperature</Title3>
            <Text className={styles.cardText}>
              <strong>Brood nest: 34-36°C (93-97°F)</strong><br />
              Bees maintain precise temperature for developing larvae. Deviations 
              indicate colony stress, disease, or queen problems. Winter clusters 
              maintain ~20°C (68°F) at the core.
            </Text>
          </Card>
          <Card className={styles.card}>
            <div className={styles.cardIcon}>💧</div>
            <Title3 className={styles.cardTitle}>Humidity</Title3>
            <Text className={styles.cardText}>
              <strong>Optimal: 50-60% RH</strong><br />
              Humidity affects honey curing and brood development. Too high causes 
              mold; too low stresses the colony. Bees fan wings to regulate moisture.
            </Text>
          </Card>
          <Card className={styles.card}>
            <div className={styles.cardIcon}>⚖️</div>
            <Title3 className={styles.cardTitle}>Weight</Title3>
            <Text className={styles.cardText}>
              <strong>Honey flow: +1-3 kg/day</strong><br />
              Weight changes reveal foraging success, honey production, and food 
              stores. Sudden drops indicate swarming (half the bees leave) or robbery.
            </Text>
          </Card>
          <Card className={styles.card}>
            <div className={styles.cardIcon}>🔊</div>
            <Title3 className={styles.cardTitle}>Acoustics</Title3>
            <Text className={styles.cardText}>
              <strong>Queen piping: 450-500 Hz</strong><br />
              Sound analysis detects queen presence, swarming preparations, and 
              colony mood. Different frequencies indicate different behaviors.
            </Text>
          </Card>
        </div>
      </section>

      {/* Microsoft Sustainability */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <LeafOne20Regular className={styles.sectionIcon} />
          <Title2>Microsoft's Sustainability Commitment</Title2>
        </div>
        <div className={styles.timeline}>
          <div className={styles.timelineItem}>
            <div className={styles.timelineDot} />
            <div className={styles.timelineTitle}>Carbon Negative by 2030</div>
            <Text className={styles.timelineText}>
              Microsoft will remove more carbon than it emits, including all historical 
              emissions since the company's founding in 1975.
            </Text>
          </div>
          <div className={styles.timelineItem}>
            <div className={styles.timelineDot} />
            <div className={styles.timelineTitle}>Water Positive by 2030</div>
            <Text className={styles.timelineText}>
              Replenish more water than we consume through conservation, restoration, 
              and access to water in stressed basins.
            </Text>
          </div>
          <div className={styles.timelineItem}>
            <div className={styles.timelineDot} />
            <div className={styles.timelineTitle}>Zero Waste by 2030</div>
            <Text className={styles.timelineText}>
              Achieve zero waste certification for campuses, manufacturing, and 
              packaging, with circular economy principles.
            </Text>
          </div>
          <div className={styles.timelineItem}>
            <div className={styles.timelineDot} />
            <div className={styles.timelineTitle}>Protect Ecosystems</div>
            <Text className={styles.timelineText}>
              Protect more land than we use by 2025. Our beehive program supports 
              biodiversity on Microsoft campuses and beyond.
            </Text>
          </div>
        </div>
      </section>

      {/* How to Get Involved */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <Lightbulb20Regular className={styles.sectionIcon} />
          <Title2>Learn More</Title2>
        </div>
        <div className={styles.cardGrid}>
          <Card className={styles.card}>
            <div className={styles.cardIcon}>🔗</div>
            <Title3 className={styles.cardTitle}>Open Source</Title3>
            <Text className={styles.cardText}>
              This entire monitoring system is open source. Deploy your own beehive 
              monitoring on Azure using our Infrastructure-as-Code templates.
              <br /><br />
              <a href="https://github.com/blueflightx7/thethingsstack-on-azure" target="_blank" rel="noopener noreferrer">
                View on GitHub →
              </a>
            </Text>
          </Card>
          <Card className={styles.card}>
            <div className={styles.cardIcon}>📚</div>
            <Title3 className={styles.cardTitle}>Resources</Title3>
            <Text className={styles.cardText}>
              <a href="https://microsoft.com/sustainability" target="_blank" rel="noopener noreferrer">
                Microsoft Sustainability →
              </a>
              <br />
              <a href="https://www.thethingsindustries.com/" target="_blank" rel="noopener noreferrer">
                The Things Industries →
              </a>
              <br />
              <a href="https://beep.nl/" target="_blank" rel="noopener noreferrer">
                BEEP Foundation →
              </a>
              <br />
              <a href="https://lora-alliance.org/" target="_blank" rel="noopener noreferrer">
                LoRa Alliance →
              </a>
            </Text>
          </Card>
          <Card className={styles.card}>
            <div className={styles.cardIcon}>🐝</div>
            <Title3 className={styles.cardTitle}>Support Bees</Title3>
            <Text className={styles.cardText}>
              • Plant native flowering plants<br />
              • Avoid pesticides in your garden<br />
              • Provide water sources for bees<br />
              • Support local beekeepers<br />
              • Spread awareness about pollinators
            </Text>
          </Card>
        </div>
      </section>
    </div>
  );
}
