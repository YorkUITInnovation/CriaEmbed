#!/bin/bash

npm run build

sleep 2

# THIS IS THE >> APP <<

docker buildx build --push \
--platform linux/amd64,linux/arm64 \
--tag uitadmin/criaembed-app:latest-nomic \
--tag uitadmin/criaembed-app:v0.5.2-nomic .