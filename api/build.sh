#!/bin/bash

npm run build

sleep 2

# THIS IS THE >> API <<

docker buildx build --push \
--platform linux/amd64,linux/arm64 \
--tag uitadmin/criaembed-api:latest-beta \
--tag uitadmin/criaembed-api:rf_v0.0.11-beta .

