// ==============================================================================
// TTS Integration - Azure Functions .NET 8 Isolated Worker Host
// ==============================================================================
//
// This is the entry point for the isolated worker process. The isolated worker
// model runs the function code in a separate process from the Azure Functions
// host, enabling full .NET 8 runtime features and independent package versions.
//
// ARCHITECTURE:
// - Azure Functions Host (manages triggers, scaling, bindings)
//   └── gRPC channel
//       └── Worker Process (.NET 8) - THIS PROCESS
//           ├── ProcessToSqlFunction (Event Hub trigger)
//           └── TtsBridgeFunction (HTTP trigger)
//
// BENEFITS OF ISOLATED MODEL:
// - Full .NET 8 runtime (not limited to host's .NET version)
// - Independent package versions (no assembly conflicts)
// - Custom middleware pipeline
// - Better testability with dependency injection
// - Graceful shutdown handling
//
// ==============================================================================

using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TtsIntegration.Services;

var host = new HostBuilder()
    .ConfigureFunctionsWebApplication()
    .ConfigureServices((context, services) =>
    {
        // Application Insights for distributed tracing and logging
        services.AddApplicationInsightsTelemetryWorkerService();
        services.ConfigureFunctionsApplicationInsights();

        // Register application services with appropriate lifetimes
        // Singleton: One instance shared across all function invocations
        // Scoped: One instance per function invocation
        // Transient: New instance every time it's requested

        // SqlDataService: Scoped because SqlConnection should not be shared across invocations
        services.AddScoped<ISqlDataService, SqlDataService>();

        // BlobStorageService: Singleton because BlobServiceClient is thread-safe and reuses connections
        services.AddSingleton<IBlobStorageService, BlobStorageService>();

        // IoTHubService: Singleton because HttpClient should be reused (socket exhaustion prevention)
        services.AddSingleton<IIoTHubService, IoTHubService>();

        // HttpClientFactory for proper HttpClient lifecycle management
        services.AddHttpClient<IIoTHubService, IoTHubService>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(10);
        });
    })
    .ConfigureLogging(logging =>
    {
        // Configure logging levels
        logging.SetMinimumLevel(LogLevel.Information);
        
        // Reduce noise from Azure SDK
        logging.AddFilter("Azure", LogLevel.Warning);
        logging.AddFilter("Azure.Core", LogLevel.Warning);
        
        // Keep function invocation logs
        logging.AddFilter("Microsoft.Azure.Functions", LogLevel.Information);
    })
    .Build();

await host.RunAsync();
