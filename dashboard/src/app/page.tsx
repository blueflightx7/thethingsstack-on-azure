'use client'

import {
  Body1,
  Caption1,
  FluentProvider,
  Subtitle1,
  Title1,
  webLightTheme,
} from '@fluentui/react-components'

export default function HomePage() {
  const webPubSubHost = process.env.NEXT_PUBLIC_WEB_PUBSUB_HOST ?? '(not set)'
  const webPubSubHub = process.env.NEXT_PUBLIC_WEB_PUBSUB_HUB ?? 'dashboard'

  return (
    <FluentProvider theme={webLightTheme}>
      <main>
        <Title1>The Things Stack on Azure — Dashboard</Title1>
        <Body1>
          This site is a lightweight, read-only dashboard shell for architecture and future real-time views.
        </Body1>

        <section className="section">
          <Subtitle1>Architecture overview</Subtitle1>
          <Body1>
            This deployment pairs a Static Web App for the UI with Azure Web PubSub for realtime events.
          </Body1>
          <dl className="kv">
            <dt>Web PubSub host</dt>
            <dd>{webPubSubHost}</dd>
            <dt>Web PubSub hub</dt>
            <dd>{webPubSubHub}</dd>
          </dl>
          <Caption1>
            Note: NEXT_PUBLIC_* values are typically embedded at build time for a static export.
          </Caption1>
        </section>

        <section className="section">
          <Subtitle1>Fabric Real-Time Intelligence</Subtitle1>
          <Body1>
            Placeholder for an embedded Fabric RTI dashboard (e.g., an iframe embed) once an embed URL is available.
          </Body1>
          <Caption1>Embed wiring is intentionally deferred.</Caption1>
        </section>

        <section className="section">
          <Subtitle1>Azure Digital Twins</Subtitle1>
          <Body1>
            Placeholder for future Digital Twins views (device/hive model, live state, and relationship graph).
          </Body1>
        </section>
      </main>
    </FluentProvider>
  )
}
