#!/bin/bash

npm run build

sleep 2

docker buildx build --push \
--platform linux/amd64,linux/arm64 \
--tag uitadmin/criaembed-app:latest \
--tag uitadmin/criaembed-app:v0.3.2 .