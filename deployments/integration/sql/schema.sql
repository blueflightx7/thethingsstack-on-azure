-- Schema for The Things Stack Data Intelligence
-- Based on Beep API structures

-- 1. Devices Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Devices')
BEGIN
    CREATE TABLE Devices (
        DeviceID INT IDENTITY(1,1) PRIMARY KEY,
        DevEUI NVARCHAR(50) NOT NULL UNIQUE,
        HardwareID NVARCHAR(100),
        Name NVARCHAR(100),
        HiveID INT,
        FirmwareVersion NVARCHAR(50),
        HardwareVersion NVARCHAR(50),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        LastSeenAt DATETIME2
    );
    CREATE INDEX IX_Devices_DevEUI ON Devices(DevEUI);
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
        SoundFrequency DECIMAL(10,2),   -- sound
        
        -- Raw Payload for debugging
        RawPayload NVARCHAR(MAX)
    );
    
    -- Clustered Index on Timestamp for TimeSeries performance
    CREATE INDEX IX_Measurements_Timestamp ON Measurements(Timestamp);
    CREATE INDEX IX_Measurements_DeviceID ON Measurements(DeviceID);
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
