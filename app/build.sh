#!/bin/bash
set -euo pipefail

# THIS IS THE >> APP <<
# Override the release tag without editing this file:  VERSION=rf_v0.0.9-beta ./build.sh
VERSION="${VERSION:-rf_v0.0.10}"
IMAGE="${IMAGE:-uitadmin/criaembed-app}"

cd "$(dirname "$0")"

npm run test
npm run build

# The image COPYs ./dist; fail here rather than deep inside the docker build.
if [ ! -f dist/index.html ]; then
    echo "dist/index.html missing - 'npm run build' did not produce a bundle." >&2
    exit 1
fi

echo "Building ${IMAGE}:${VERSION}"
docker buildx build --push \
--platform linux/amd64,linux/arm64 \
--tag "${IMAGE}:latest" \
--tag "${IMAGE}:${VERSION}" .
