# ============================================================================
# The Things Stack Dockerfile
# Multi-stage build for production deployment
# ============================================================================
# This Dockerfile is used by GitHub Actions to build custom TTS images
# Base image: Official The Things Industries LoRaWAN Stack
# ============================================================================

ARG TTS_VERSION=3.30.2

# ============================================================================
# STAGE 1: Base TTS Image
# ============================================================================
FROM docker.io/thethingsindustries/lorawan-stack:${TTS_VERSION} AS base

# Add labels for tracking
LABEL maintainer="your-email@example.com"
LABEL org.opencontainers.image.source="https://github.com/blueflightx7/thethingsstack-on-azure"
LABEL org.opencontainers.image.description="The Things Stack for Azure"
LABEL org.opencontainers.image.version="${TTS_VERSION}"

# ============================================================================
# STAGE 2: Custom Extensions (Optional)
# ============================================================================
FROM base AS extensions

# Install additional tools if needed (optional)
RUN apk add --no-cache \
    ca-certificates \
    curl \
    jq \
    bash

# Copy custom configuration templates (if any)
# COPY config/ /etc/tts/

# ============================================================================
# STAGE 3: Final Image
# ============================================================================
FROM extensions AS final

# Set working directory
WORKDIR /srv/tts

# Expose standard TTS ports
EXPOSE 80 443 1700/udp 1881-1887 8881-8887

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:1885/healthz || exit 1

# Run as non-root user (TTS default: 886)
USER 886:886

# Default command (can be overridden by docker-compose)
ENTRYPOINT ["/usr/bin/tts"]
CMD ["start"]

# ============================================================================
# BUILD INSTRUCTIONS
# ============================================================================
# Local build:
#   docker build -t thethingsstack:latest --build-arg TTS_VERSION=3.30.2 .
#
# GitHub Actions build (automatic):
#   Triggered on push to main branch
#   Includes vulnerability scanning with Trivy
#   Pushes to Azure Container Registry
#
# Custom version:
#   docker build -t thethingsstack:v3.30.2 --build-arg TTS_VERSION=3.30.2 .
# ============================================================================
