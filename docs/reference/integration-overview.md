# IoT Hub Integration Overview

The **IoT Hub & Data Intelligence** integration (Option 6) is a powerful add-on for The Things Stack on Azure. It unlocks the full potential of the Azure data ecosystem for your LoRaWAN fleet.

## Key Features

*   **Seamless Ingestion**: Direct integration with TTS Webhooks via Azure IoT Hub.
*   **Serverless Architecture**: Zero maintenance of VMs or clusters. Scales to zero when not in use.
*   **Data Lake Ready**: Stores data in Azure SQL (structured) and Blob Storage (raw/archival).
*   **Analytics Ready**: Native compatibility with Microsoft Fabric, Power BI, and Azure Stream Analytics.
*   **Secure**: Uses Managed Identities and RBAC. No hardcoded secrets.

## Use Cases

1.  **Long-term Archival**: Keep years of telemetry data at low cost.
2.  **Business Intelligence**: Build dashboards in Power BI to visualize network health and sensor data.
3.  **Advanced Analytics**: Use Fabric/Synapse to run machine learning models on historical data.
4.  **Custom Integration**: Trigger Logic Apps or other Azure Functions based on specific telemetry events.

## How it Works

The integration deploys a parallel stack alongside your TTS instance (VM or AKS). It does **not** modify your existing TTS configuration, making it safe to deploy and remove.

1.  **Deploy**: Run `deploy.ps1` and select Option 6.
2.  **Configure**: Add the generated Webhook URL to your TTS Application.
3.  **Analyze**: Connect Power BI or Fabric to the generated SQL Database.

## Next Steps

*   [Deployment Guide](../deploy/integration-deployment.md)
*   [Architecture Deep Dive](integration-architecture.md)
*   [Operations Guide](../operate/integration-operations.md)
