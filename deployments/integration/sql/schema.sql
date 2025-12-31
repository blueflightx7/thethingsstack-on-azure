-- ==============================================================================
-- The Things Stack Data Intelligence - SQL Database Schema
-- ==============================================================================
--
-- PURPOSE:
-- This schema supports telemetry data storage for beehive monitoring devices
-- using The Things Stack LoRaWAN network. Based on Beep API data structures.
--
-- ARCHITECTURE:
-- 3-table normalized schema optimized for time-series queries:
--
-- Devices (1) ──┬── (N) Measurements
--               └── (1) Hives
--
-- DESIGN DECISIONS:
-- 1. DevEUI as unique identifier (LoRaWAN standard)
-- 2. Time-series optimized with clustered index on Timestamp
-- 3. Foreign key constraints for referential integrity
-- 4. Nullable measurement columns (sensors may not always report all values)
-- 5. RawPayload column for debugging and future decoding changes
--
-- INDEXING STRATEGY:
-- - Devices: DevEUI (frequent lookups by device identifier)
-- - Measurements: DeviceID + Timestamp (time-series range queries)
-- - Measurements: Timestamp only (cross-device temporal queries)
--
-- DATA LIFECYCLE:
-- - No automatic retention policy (configure via SQL Server Agent or Logic Apps)
-- - Consider partitioning Measurements table by date for large datasets (>10M rows)
-- - Archive old data to Blob Storage for cost optimization
--
-- PERFORMANCE:
-- - Auto-pause enabled (1 hour idle) for cost savings
-- - Serverless tier: 0.5-4 vCores, scales on-demand
-- - Estimated cost: $5-15/month depending on query frequency
--
-- MIGRATION:
-- - Idempotent: Safe to run multiple times (IF NOT EXISTS checks)
-- - No versioning system (manual migration tracking)
-- - Future: Consider Entity Framework migrations or Flyway
--
-- ==============================================================================

-- Schema for The Things Stack Data Intelligence
-- Based on Beep API structures

-- ==============================================================================
-- TABLE 1: Devices
-- ==============================================================================
-- Stores LoRaWAN device metadata and links to hives.
-- One device per beehive sensor unit.
-- ==============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Devices')
BEGIN
    CREATE TABLE Devices (
        DeviceID INT IDENTITY(1,1) PRIMARY KEY,
        DevEUI NVARCHAR(50) NOT NULL UNIQUE,
        HardwareID NVARCHAR(100),
        Name NVARCHAR(100),
        ApplicationID NVARCHAR(100), -- TTS Application ID
        HiveID INT,
        FirmwareVersion NVARCHAR(50),
        HardwareVersion NVARCHAR(50),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        LastSeenAt DATETIME2
    );
    CREATE INDEX IX_Devices_DevEUI ON Devices(DevEUI);
END

-- Additive columns for device↔hive identity correlation
IF COL_LENGTH('Devices', 'HiveIdentity') IS NULL
BEGIN
    ALTER TABLE Devices ADD HiveIdentity UNIQUEIDENTIFIER NULL;
END

IF COL_LENGTH('Devices', 'HiveName') IS NULL
BEGIN
    ALTER TABLE Devices ADD HiveName NVARCHAR(255) NULL;
END

-- 2. Hives Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Hives')
BEGIN
    CREATE TABLE Hives (
        HiveID INT PRIMARY KEY, -- Matches Beep Hive ID
        Name NVARCHAR(100),
        Location NVARCHAR(200),
        HiveType NVARCHAR(50),
        OwnerID INT,
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
END

-- 2b. Gateways & Hive↔Gateway mapping
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Gateways')
BEGIN
    CREATE TABLE Gateways (
        GatewayID INT IDENTITY(1,1) PRIMARY KEY,
        GatewayIdentifier NVARCHAR(255) NOT NULL UNIQUE,
        LastSeen DATETIME2 NULL,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE()
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HiveGateways')
BEGIN
    CREATE TABLE HiveGateways (
        HiveID INT NOT NULL,
        GatewayID INT NOT NULL,
        FirstSeen DATETIME2 DEFAULT GETUTCDATE(),
        LastSeen DATETIME2 NULL,
        PRIMARY KEY (HiveID, GatewayID),
        FOREIGN KEY (HiveID) REFERENCES Hives(HiveID),
        FOREIGN KEY (GatewayID) REFERENCES Gateways(GatewayID)
    );
END

-- Preferred mapping: deterministic HiveIdentity (GUID) -> Gateways
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HiveIdentityGateways')
BEGIN
    CREATE TABLE HiveIdentityGateways (
        HiveIdentity UNIQUEIDENTIFIER NOT NULL,
        GatewayID INT NOT NULL,
        FirstSeen DATETIME2 DEFAULT GETUTCDATE(),
        LastSeen DATETIME2 NULL,
        PRIMARY KEY (HiveIdentity, GatewayID),
        FOREIGN KEY (GatewayID) REFERENCES Gateways(GatewayID)
    );
END

-- 3. Measurements Table (TimeSeries optimized)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Measurements')
BEGIN
    CREATE TABLE Measurements (
        MeasurementID BIGINT IDENTITY(1,1) PRIMARY KEY,
        DeviceID INT FOREIGN KEY REFERENCES Devices(DeviceID),
        Timestamp DATETIME2 NOT NULL,
        
        -- Common Beep Measurements
        Temperature_Inner DECIMAL(5,2), -- t_i
        Temperature_Outer DECIMAL(5,2), -- t_o
        Humidity DECIMAL(5,2),          -- h
        Weight_KG DECIMAL(10,3),        -- weight_kg
        BatteryVoltage DECIMAL(5,2),    -- bv
        BatteryPercent INT,             -- bat_perc
        SoundFrequency DECIMAL(10,2),   -- sound
        
        -- FFT Bins (Sound Frequency Analysis)
        FFT_Bin_71_122 INT,             -- s_bin_71_122
        FFT_Bin_122_173 INT,            -- s_bin_122_173
        FFT_Bin_173_224 INT,            -- s_bin_173_224
        FFT_Bin_224_276 INT,            -- s_bin_224_276
        FFT_Bin_276_327 INT,            -- s_bin_276_327
        FFT_Bin_327_378 INT,            -- s_bin_327_378
        FFT_Bin_378_429 INT,            -- s_bin_378_429
        FFT_Bin_429_480 INT,            -- s_bin_429_480
        FFT_Bin_480_532 INT,            -- s_bin_480_532
        FFT_Bin_532_583 INT,            -- s_bin_532_583
        
        -- Gateway Metadata (Location & Signal Quality)
        Latitude DECIMAL(9,6),          -- gateway location
        Longitude DECIMAL(9,6),         -- gateway location
        RSSI INT,                       -- signal strength
        SNR DECIMAL(5,2),               -- signal-to-noise ratio
        
        -- Raw Payload for debugging and re-ingestion
        RawPayload NVARCHAR(MAX),
        GatewayID INT NULL,
        CorrelationId NVARCHAR(512) NULL
    );
    
    -- Clustered Index on Timestamp for TimeSeries performance
    CREATE INDEX IX_Measurements_Timestamp ON Measurements(Timestamp);
    CREATE INDEX IX_Measurements_DeviceID ON Measurements(DeviceID);
END

-- Additive columns for measurements (safe on existing deployments)
IF COL_LENGTH('Measurements', 'GatewayID') IS NULL
BEGIN
    ALTER TABLE Measurements ADD GatewayID INT NULL;
END

IF COL_LENGTH('Measurements', 'CorrelationId') IS NULL
BEGIN
    ALTER TABLE Measurements ADD CorrelationId NVARCHAR(512) NULL;
END

-- FK: Measurements.GatewayID -> Gateways.GatewayID
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Measurements_GatewayID')
BEGIN
    EXEC(N'ALTER TABLE Measurements
    ADD CONSTRAINT FK_Measurements_GatewayID
    FOREIGN KEY (GatewayID) REFERENCES Gateways(GatewayID);');
END

-- Dedupe by correlation id when available
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_Measurements_CorrelationId_Unique'
      AND object_id = OBJECT_ID('Measurements')
)
BEGIN
    -- Use dynamic SQL so this works even when CorrelationId is added earlier in the same script run.
    EXEC(N'CREATE UNIQUE INDEX IX_Measurements_CorrelationId_Unique
    ON Measurements(CorrelationId)
    WHERE CorrelationId IS NOT NULL;');
END

-- 4. Alerts Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Alerts')
BEGIN
    CREATE TABLE Alerts (
        AlertID INT IDENTITY(1,1) PRIMARY KEY,
        DeviceID INT FOREIGN KEY REFERENCES Devices(DeviceID),
        AlertRuleID INT,
        TriggeredAt DATETIME2 DEFAULT GETDATE(),
        Message NVARCHAR(500),
        Severity NVARCHAR(20), -- Info, Warning, Critical
        IsActive BIT DEFAULT 1,
        ResolvedAt DATETIME2
    );
END
