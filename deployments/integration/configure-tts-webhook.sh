#!/bin/bash
# Run this on your TTS VM to configure the Webhook

WEBHOOK_URL="https://tts-int-func-tkrq6jjnphvvy.azurewebsites.net/api/IngestWebhook"
API_KEY="<YOUR_TTS_API_KEY>"
APP_ID="<YOUR_APP_ID>"

echo "Configuring Webhook for \..."

curl -X POST \
  "http://localhost:1885/api/v3/as/applications/\/webhooks" \
  -H "Authorization: Bearer \" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": { "webhook_id": "azure-integration" },
    "base_url": "'"\"'",
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
