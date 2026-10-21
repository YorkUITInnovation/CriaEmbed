#!/bin/bash
set -euo pipefail

# THIS IS THE >> API <<
# Override the release tag without editing this file:  VERSION=rf_v0.0.16 ./build.sh
VERSION="${VERSION:-rf_v0.0.16}"
IMAGE="${IMAGE:-uitadmin/criaembed-api}"

cd "$(dirname "$0")"

# Dockerfile builds in-image; no host npm needed.
echo "Building ${IMAGE}:${VERSION}"
docker buildx build --push \
--platform linux/amd64,linux/arm64 \
--tag "${IMAGE}:latest" \
--tag "${IMAGE}:${VERSION}" .
