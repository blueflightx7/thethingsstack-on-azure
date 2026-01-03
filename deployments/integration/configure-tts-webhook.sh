#!/bin/bash
# Run this on your TTS VM to configure the Webhook

WEBHOOK_URL="<YOUR_WEBHOOK_URL>"  # Example: https://<func>.azurewebsites.net/api/IngestWebhook
API_KEY="<YOUR_TTS_API_KEY>"
APP_ID="<YOUR_APP_ID>"
FUNCTION_KEY="<YOUR_FUNCTION_KEY>"  # Sent as x-functions-key header from TTS -> Azure Function

echo "Configuring Webhook for $APP_ID..."

curl -X POST \
  "http://localhost:1885/api/v3/as/applications/$APP_ID/webhooks" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": { "webhook_id": "azure-integration" },
    "base_url": "'"$WEBHOOK_URL"'",
    "headers": {
      "x-functions-key": "'"$FUNCTION_KEY"'"
    },
    "format": "json",
    "uplink_message": { "path": "" },
    "join_accept": { "path": "" },
    "downlink_ack": { "path": "" },
    "downlink_nack": { "path": "" },
    "downlink_sent": { "path": "" },
    "downlink_failed": { "path": "" },
    "downlink_queued": { "path": "" },
    "location_solved": { "path": "" }
  }'

echo "Webhook configured!"
