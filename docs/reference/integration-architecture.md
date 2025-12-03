# IoT Hub & Data Intelligence Architecture

This document provides a technical deep-dive into the architecture of the "IoT Hub & Data Intelligence" integration (Deployment Option 6). It details the components, data flow, security model, and design decisions that enable high-scale LoRaWAN data ingestion and analytics.

## 1. High-Level Architecture

The integration bridges The Things Stack (TTS) with Azure's data ecosystem using a serverless, event-driven architecture. It is designed to be **stateless**, **scalable**, and **secure**.

```mermaid
graph TD
    subgraph "The Things Stack"
        TTS[TTS Application Server]
        Webhook[Webhooks]
    end

    subgraph "Azure Integration"
        IoTHub[Azure IoT Hub]
        EventHub[Azure Event Hub]
        
        subgraph "Compute & Processing"
            Func[Azure Functions\n(TtsBridge)]
            Checkpoints[Blob Storage\n(Checkpoints)]
        end
        
        subgraph "Data Storage"
            SQL[Azure SQL Database\n(Serverless)]
            DLQ[Blob Storage\n(Dead Letter)]
        end
    end

    subgraph "Analytics & Consumption"
        Fabric[Microsoft Fabric]
        PBI[Power BI]
        Apps[Custom Apps]
    end

    TTS -->|HTTP POST| IoTHub
    IoTHub -->|Routes| EventHub
    EventHub -->|Trigger| Func
    Func -->|Read/Write| Checkpoints
    Func -->|Batch Insert| SQL
    Func -->|Error| DLQ
    SQL -->|Query| Fabric
    SQL -->|Query| PBI
```

## 2. Component Deep Dive

### 2.1 Azure IoT Hub (Ingestion Gateway)
*   **Role**: The primary entry point for data from The Things Stack.
*   **Configuration**:
    *   **SKU**: Standard (S1) or Basic (B1) depending on bidirectional needs.
    *   **Authentication**: Shared Access Policy (RegistryReadWrite, ServiceConnect, DeviceConnect).
    *   **Routing**: Custom routing endpoints are configured to send telemetry to Event Hubs.
*   **Why IoT Hub?**: Provides a secure, scalable MQTT/HTTP endpoint that TTS Webhooks can target. It handles device identity management and can sync TTS device registry with Azure (future capability).

### 2.2 Azure Event Hub (Buffering & Decoupling)
*   **Role**: Acts as a high-throughput buffer between ingestion (IoT Hub) and processing (Functions).
*   **Configuration**:
    *   **Partitions**: Default 2 (scalable).
    *   **Retention**: 1 day (configurable).
    *   **Consumer Groups**: Dedicated consumer group for the Function App (`tts-processor`).
*   **Why Event Hub?**: Decouples the ingestion rate from the processing rate. If the database slows down, Event Hub buffers the messages, preventing data loss at the webhook level.

### 2.3 Azure Functions (Processing Engine)
*   **Role**: Processes incoming telemetry batches and persists them to SQL.
*   **Runtime**: .NET 8 Isolated (C# script `.csx` for flexibility).
*   **Pattern**: **Stateless HttpClient**.
    *   A static `HttpClient` instance is reused across executions to prevent socket exhaustion.
    *   Uses `SqlConnectionStringBuilder` and `SqlConnection` for efficient database interaction.
*   **Trigger**: Event Hub Trigger (batches of messages).
*   **Scaling**: Consumption Plan (scales to zero, scales out based on lag).

### 2.4 Azure SQL Database (Storage & Analytics)
*   **Role**: Relational storage for structured telemetry data.
*   **SKU**: Serverless (General Purpose).
    *   **Auto-pause**: Pauses after 1 hour of inactivity to save costs.
    *   **Auto-scale**: Scales vCores between min (0.5) and max (4) based on load.
*   **Schema**:
    *   `uplink_data`: Stores raw JSON payloads and extracted fields (DevEUI, FPort, RSSI, SNR).
    *   **JSON Support**: Uses `OPENJSON` for efficient querying of the flexible `payload` column.

### 2.5 Azure Blob Storage (State & Reliability)
*   **Role**: Supporting storage for the architecture.
*   **Containers**:
    *   `azure-webjobs-hosts`: Function App internal locks and secrets.
    *   `azure-webjobs-eventhub`: Event Hub checkpoints (cursor position).
    *   `dead-letter`: Stores messages that failed processing (for replay/analysis).

## 3. Data Flow

1.  **Ingest**: TTS Webhook sends a JSON payload (Uplink message) to IoT Hub via HTTP.
2.  **Route**: IoT Hub routes the message to the built-in Event Hub compatible endpoint.
3.  **Buffer**: Event Hub receives the message and stores it in a partition.
4.  **Trigger**: The `TtsBridge` function wakes up when a batch of messages is ready (or timeout occurs).
5.  **Process**:
    *   The function iterates through the batch.
    *   It extracts key metadata (DevEUI, Timestamp, Payload).
    *   It constructs a SQL `INSERT` statement (or bulk copy).
6.  **Persist**: The batch is committed to the `uplink_data` table in Azure SQL.
7.  **Checkpoint**: The function updates the checkpoint in Blob Storage, marking messages as processed.

## 4. Security Model

The architecture adheres to "Secure by Default" principles.

### 4.1 Identity & Access Management (IAM)
*   **Managed Identity**: The Function App uses a System-Assigned Managed Identity.
*   **RBAC Assignments**:
    *   `Azure Event Hubs Data Receiver`: Function App -> Event Hub.
    *   `Storage Blob Data Owner`: Function App -> Storage Account.
    *   `SQL Server Contributor` (or specific DB roles): Function App -> SQL Server.
*   **No Secrets in Code**: Connection strings use Managed Identity where possible, or Key Vault references.

### 4.2 Network Security
*   **TLS 1.2**: Enforced on all services (IoT Hub, Event Hub, SQL, Storage).
*   **Firewalls**:
    *   SQL Server: "Allow Azure Services" enabled (for Function App access).
    *   Storage: Supports VNet integration (optional in advanced config).

### 4.3 Data Protection
*   **Encryption at Rest**: All data in Blob Storage, Event Hub, and SQL Database is encrypted by platform-managed keys.
*   **Encryption in Transit**: All traffic is HTTPS/TLS encrypted.

## 5. Scalability & Performance

### 5.1 Throughput
*   **Event Hubs**: Can handle millions of events per second by increasing Throughput Units (TUs).
*   **Functions**: Scales out to hundreds of instances to process partitions in parallel.
*   **SQL**: Serverless tier automatically adds CPU/Memory during bursts.

### 5.2 Resilience
*   **Retries**: The Function App has built-in retry policies for transient failures (e.g., SQL connection timeout).
*   **Dead Lettering**: Messages that fail repeatedly (e.g., malformed JSON) are moved to Blob Storage to prevent blocking the stream.
*   **Geo-Redundancy**: Can be enabled for Storage and SQL (RA-GRS) for disaster recovery.

## 6. Cost Analysis

Estimated monthly costs for different usage tiers (Central US pricing, subject to change).

| Component | Low Volume (<100k msgs/mo) | Medium Volume (1M msgs/mo) | High Volume (10M msgs/mo) |
| :--- | :--- | :--- | :--- |
| **IoT Hub** | Free (8k/day) | $25 (S1) | $250 (S2) |
| **Event Hub** | Basic ($11) | Basic ($11) | Standard ($22) |
| **Functions** | Free Grant | Free Grant | ~$10 |
| **SQL DB** | ~$5 (Serverless) | ~$10 (Serverless) | ~$30 (Serverless) |
| **Storage** | <$1 | <$1 | ~$5 |
| **Total** | **~$17/mo** | **~$47/mo** | **~$317/mo** |

*Note: Costs can be optimized by using Reserved Instances or adjusting retention policies.*

## 7. Design Decisions & Trade-offs

| Decision | Rationale | Trade-off |
| :--- | :--- | :--- |
| **SQL Serverless** | Cost-effective for sporadic IoT traffic patterns. | Slight "cold start" latency (10-30s) if paused. |
| **C# Script (.csx)** | Allows editing code directly in the portal for quick tweaks. | No CI/CD pipeline by default (requires setup). |
| **Event Hub Buffer** | Protects SQL from write spikes. | Adds slight latency (sub-second) to data availability. |
| **Managed Identity** | Eliminates credential rotation headaches. | Requires Azure-specific configuration (RBAC). |

## 8. Future Roadmap

*   **Device Twin Sync**: Two-way synchronization of device registry between TTS and IoT Hub.
*   **Command & Control**: Sending downlink messages from Azure to TTS devices via IoT Hub Cloud-to-Device messages.
*   **Stream Analytics**: Real-time anomaly detection on the Event Hub stream before storage.
