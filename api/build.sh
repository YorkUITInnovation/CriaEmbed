#!/bin/bash

npm run build

sleep 2

# Create and use a buildx builder that supports multi-platform builds
docker buildx create --name multiplatform-builder --use --bootstrap
# THIS IS THE >> API <<

docker buildx build --push \
--platform linux/amd64,linux/arm64 \
--tag uitadmin/criaembed-api:latest.2-nomic \
--tag uitadmin/criaembed-api:v0.5.2-nomic .

