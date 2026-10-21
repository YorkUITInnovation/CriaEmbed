#!/bin/bash
set -euo pipefail

# THIS IS THE >> APP <<
# Override the release tag without editing this file:  VERSION=rf_v0.0.12 ./build.sh
VERSION="${VERSION:-rf_v0.0.12}"
IMAGE="${IMAGE:-uitadmin/criaembed-app}"

cd "$(dirname "$0")"

# Dockerfile builds in-image; no host npm needed. Run `npm test` before release.
echo "Building ${IMAGE}:${VERSION}"
docker buildx build --push \
--platform linux/amd64,linux/arm64 \
--tag "${IMAGE}:latest" \
--tag "${IMAGE}:${VERSION}" .
