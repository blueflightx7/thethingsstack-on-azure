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
        FuncIngest[Azure Function\n(IngestWebhook)]
        IoTHub[Azure IoT Hub]
        EventHub[Azure Event Hub\n(fabric-stream)]
        FuncSql[Azure Function\n(ProcessToSQL)]

        subgraph "Data Storage"
            SQL[Azure SQL Database\n(Serverless)]
            Storage[Storage Account\n(raw-telemetry / processed-data / dead-letter)]
        end
    end

    subgraph "Analytics & Consumption"
        Fabric[Microsoft Fabric]
        PBI[Power BI]
        Apps[Custom Apps]
    end

    TTS -->|HTTP POST| FuncIngest
    FuncIngest -->|IoT Hub REST API| IoTHub
    IoTHub -->|Route: ToFabric| EventHub
    IoTHub -->|Route: ToArchive| Storage
    EventHub -->|Trigger| FuncSql
    FuncSql -->|Upsert/insert| SQL
    FuncSql -->|Write raw + cleaned| Storage
    EventHub -.Connection String.-> Fabric
    SQL -->|Query| PBI
    SQL -->|Query| Apps
```

## 2. Component Deep Dive

### 2.1 Azure IoT Hub (Ingestion + Routing)
*   **Role**: Receives messages forwarded by `IngestWebhook` and routes them to Event Hub and Blob Storage.
*   **Configuration**:
    *   **SKU**: Standard (S1) or Basic (B1) depending on bidirectional needs.
    *   **Authentication**: Shared Access Policy (RegistryReadWrite, ServiceConnect, DeviceConnect).
    *   **Routing**: Custom routing endpoints are configured to send telemetry to Event Hubs.
*   **Why IoT Hub?**: Provides a managed routing layer that splits real-time streaming (Event Hub) from archival (Blob).

### 2.2 Azure Event Hub (Buffering & Decoupling)
*   **Role**: Acts as a high-throughput buffer between ingestion (IoT Hub) and processing (Functions).
*   **Configuration**:
    *   **Partitions**: Default 2 (scalable).
    *   **Retention**: 1 day (configurable).
    *   **Consumer Groups**: The `ProcessToSQL` trigger uses `$Default` (configured in the function binding).
*   **Why Event Hub?**: Decouples the ingestion rate from the processing rate. If the database slows down, Event Hub buffers the messages, preventing data loss at the webhook level.

### 2.3 Azure Functions (Processing Engine)
*   **Role**:
    *   `IngestWebhook`: receives TTS webhook JSON and forwards it into IoT Hub.
    *   `ProcessToSQL`: consumes Event Hub batches, writes to SQL, and writes two blobs per uplink (raw + cleaned).
*   **Runtime**: Azure Functions v4, `FUNCTIONS_WORKER_RUNTIME=dotnet`.
*   **Trigger**: Event Hub Trigger for `ProcessToSQL`.
*   **Scaling**: Consumption Plan (scales to zero, scales out based on lag).

### 2.4 Azure SQL Database (Storage & Analytics)
*   **Role**: Relational storage for structured telemetry data.
*   **SKU**: Serverless (General Purpose).
    *   **Auto-pause**: Pauses after 1 hour of inactivity to save costs.
    *   **Auto-scale**: Scales vCores between min (0.5) and max (4) based on load.
*   **Schema** (high level):
    *   `Devices`: per-device identity (includes deterministic `HiveIdentity`)
    *   `Gateways`: gateway catalog
    *   `HiveIdentityGateways`: hive-to-gateway mapping
    *   `Measurements`: per-uplink measurements with `RawPayload` JSON and `CorrelationId` de-duplication

### 2.5 Azure Blob Storage (State & Reliability)
*   **Role**: Raw archival + processed payload storage.
*   **Containers**:
    *   `raw-telemetry`: contains IoT Hub archive batches (IoT Hub folder layout) and per-uplink raw blobs written by `ProcessToSQL`.
    *   `processed-data`: contains per-uplink cleaned/extracted payloads written by `ProcessToSQL`.
    *   `dead-letter`: contains per-uplink error envelopes written by `ProcessToSQL` when a message cannot be processed.
*   **Note**: The same Storage Account is also used for the Function host files and Event Hub checkpoints.

## 3. Data Flow

1.  **Ingest**: TTS Webhook sends a JSON payload to the Integration Function App (`IngestWebhook`).
2.  **Forward**: `IngestWebhook` forwards the payload into IoT Hub.
3.  **Route**: IoT Hub routes the message to Event Hub and to the raw archive container.
3.  **Buffer**: Event Hub receives the message and stores it in a partition.
4.  **Trigger**: `ProcessToSQL` wakes up when a batch of messages is ready (or timeout occurs).
5.  **Process**:
    *   The function iterates through the batch.
    *   It extracts key metadata (DevEUI, Timestamp, Payload).
    *   It constructs a SQL `INSERT` statement (or bulk copy).
6.  **Persist**: The batch is committed to `Measurements` in Azure SQL (with de-duplication by `CorrelationId`).
7.  **Checkpoint**: The function updates the checkpoint in Blob Storage, marking messages as processed.

## 4. Security Model

The architecture adheres to "Secure by Default" principles.

### 4.1 Identity & Access Management (IAM)
*   **App Settings**: The Function App authenticates to IoT Hub, Event Hubs, Storage, and SQL using connection strings injected via app settings.
*   **Key Vault**: Deployment scripts store connection strings in Key Vault and populate Function App settings from there.
*   **Managed Identity (optional)**: A system-assigned managed identity can be enabled for the Function App, but the integration currently relies on connection strings rather than RBAC-based data-plane access.

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
*   **Poison Messages**: Malformed messages are logged and skipped so they do not block processing. The raw archive containers can be used to inspect problematic payloads.
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
| **C# Script (.csx)** | Fast iteration for integration processing. | Dependency packaging must be handled explicitly for portal/ZIP deployments. |
| **Event Hub Buffer** | Protects SQL from write spikes. | Adds slight latency (sub-second) to data availability. |
| **Managed Identity** | Eliminates credential rotation headaches. | Requires Azure-specific configuration (RBAC). |

## 8. Future Roadmap

*   **Device Twin Sync**: Two-way synchronization of device registry between TTS and IoT Hub.
*   **Command & Control**: Sending downlink messages from Azure to TTS devices via IoT Hub Cloud-to-Device messages.
*   **Stream Analytics**: Real-time anomaly detection on the Event Hub stream before storage.
