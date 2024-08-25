#!/bin/bash

npm run build

sleep 2

docker buildx build --push \
--platform linux/amd64,linux/arm64 \
--tag uitadmin/criaembed-api:latest \
--tag uitadmin/criaembed-api:v0.3.2  .