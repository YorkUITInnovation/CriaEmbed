#           BASIC FILE SETUP

FROM        node:22-bullseye-slim AS base

LABEL       author="Isaac Kogan" maintainer="koganisa@yorku.ca"

#           LINUX PACKAGES

RUN         apt update \
            && apt -y install ffmpeg iproute2 git sqlite3 libsqlite3-dev python3 python3-dev ca-certificates dnsutils tzdata zip tar curl build-essential libtool iputils-ping libnss3 tini \
            && useradd -m -d /home/cria cria

FROM        base AS with_packages

#           USER & ENTRYPOINT

ENV         USER=cria HOME=/home/cria
WORKDIR     /home/cria

#           NODE PACKAGES

COPY        --chown=cria:cria package.json ./

#           Runtime only serves ./dist via `serve`, so devDependencies
#           (vite, eslint, prettier) are not needed in the image.
USER        cria
RUN         npm install --omit=dev --no-audit --no-fund

FROM        with_packages AS final

USER        root

#           PROJECT SOURCE CODE

COPY        --chown=cria:cria ./dist ./dist
RUN         chmod -R u+rwX,go+rX /home/cria/dist

#           START SERVER

COPY        --chown=cria:cria ./entrypoint.sh /entrypoint.sh
RUN         chmod +x /entrypoint.sh
USER        cria
ENTRYPOINT  ["/usr/bin/tini", "-g", "--"]
CMD         ["/entrypoint.sh"]
