#!/bin/bash

npm run build

sleep 2

# THIS IS THE >> APP <<

docker buildx build --push \
--platform linux/amd64,linux/arm64 \
--tag uitadmin/criaembed-app:latest-beta \
--tag uitadmin/criaembed-app:rf_v0.0.8-beta .