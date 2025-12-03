# Function App Reference: TtsBridge

The `TtsBridge` is an Azure Function designed to ingest LoRaWAN telemetry from Event Hubs and persist it to Azure SQL.

## Function Details

*   **Name**: `TtsBridge`
*   **Trigger**: `EventHubTrigger`
*   **Input**: Batches of `EventData` objects.
*   **Output**: SQL `INSERT` statements.

## Configuration (App Settings)

The Function App relies on the following Environment Variables (App Settings):

| Setting | Description |
| :--- | :--- |
| `AzureWebJobsStorage` | Connection string for the internal storage account. |
| `EventHubConnection` | Connection string for the Event Hub Namespace (Listen). |
| `SqlConnectionString` | ADO.NET Connection string for Azure SQL. |
| `FUNCTIONS_WORKER_RUNTIME` | Set to `dotnet-isolated`. |

## Code Structure (`run.csx`)

The code follows the **Stateless HttpClient** pattern.

```csharp
// Static HttpClient to prevent socket exhaustion
private static readonly HttpClient httpClient = new HttpClient();

public static async Task Run(EventData[] events, FunctionContext context)
{
    // 1. Initialize Logger
    var logger = context.GetLogger("TtsBridge");

    // 2. Connect to SQL
    using (SqlConnection conn = new SqlConnection(Environment.GetEnvironmentVariable("SqlConnectionString")))
    {
        await conn.OpenAsync();

        // 3. Process Batch
        foreach (var eventData in events)
        {
            try 
            {
                // Parse JSON
                string jsonBody = Encoding.UTF8.GetString(eventData.EventBody);
                // Extract Metadata
                // Insert into SQL
            }
            catch (Exception ex)
            {
                // Log Error
                // (Optional) Send to Dead Letter Blob
            }
        }
    }
}
```

## Error Handling

*   **Transient Errors**: The SQL connection logic includes retry policies (handled by the .NET SQL client).
*   **Poison Messages**: If a message cannot be parsed or inserted, the function logs the error. In a production environment, these should be explicitly written to a "Dead Letter" blob container to avoid data loss.

## Performance Tuning

*   **Batch Size**: Configurable in `host.json` (default is usually 10-100). Larger batches improve SQL throughput but increase memory usage.
*   **Prefetch Count**: Controls how many events the Event Hub client fetches at once.
