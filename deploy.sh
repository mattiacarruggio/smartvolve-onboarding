#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# SmartVolve Onboarding — Cloud Run deploy script
#
# Prerequisites:
#   - gcloud CLI authenticated (gcloud auth login)
#   - Docker or Cloud Build enabled on the project
#   - Artifact Registry / Container Registry API enabled
###############################################################################

PROJECT_ID="smartvolve-factory"
IMAGE="gcr.io/${PROJECT_ID}/onboarding-mvp:latest"
SERVICE="onboarding-mvp"
REGION="europe-west8"

echo "──────────────────────────────────────────────"
echo "🔧  Setting project to ${PROJECT_ID}"
echo "──────────────────────────────────────────────"
gcloud config set project "${PROJECT_ID}"

echo ""
echo "──────────────────────────────────────────────"
echo "📦  Building container image via Cloud Build"
echo "──────────────────────────────────────────────"
gcloud builds submit --tag "${IMAGE}"

echo ""
echo "──────────────────────────────────────────────"
echo "🚀  Deploying to Cloud Run (${REGION})"
echo "──────────────────────────────────────────────"
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 60s

echo ""
echo "──────────────────────────────────────────────"
echo "🔄  Sending all traffic to latest revision"
echo "──────────────────────────────────────────────"
gcloud run services update-traffic "${SERVICE}" \
  --region "${REGION}" \
  --to-latest

echo ""
echo "──────────────────────────────────────────────"
echo "✅  Deploy complete!"
echo "──────────────────────────────────────────────"

# Save deployed URL
URL=$(gcloud run services describe "${SERVICE}" \
  --region "${REGION}" \
  --format "value(status.url)")
echo "${URL}" > .cloudrun-url
echo "📎  URL: ${URL}"
echo "   (saved to .cloudrun-url)"
