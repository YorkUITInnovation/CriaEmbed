#!/bin/bash

docker buildx build --push \
--platform linux/amd64,linux/arm64 \
--tag uitadmin/criaembed-api:latest \
--tag uitadmin/criaembed-api:v0.0.5 .