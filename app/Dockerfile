#           BASIC FILE SETUP

FROM        node:22-bullseye-slim AS base

LABEL       author="Isaac Kogan" maintainer="koganisa@yorku.ca"

#           LINUX PACKAGES

RUN         apt update \
            && apt -y install ffmpeg iproute2 git sqlite3 libsqlite3-dev python3 python3-dev ca-certificates dnsutils tzdata zip tar curl build-essential libtool iputils-ping libnss3 tini \
            && useradd -m -d /home/cria cria

FROM        base AS with_packages

#           USER & ENTRYPOINT

USER        cria
ENV         USER=cria HOME=/home/cria
WORKDIR     /home/cria

#           PYTHON PACKAGES

COPY        package.json ./

RUN         npm install

FROM        with_packages AS final

#           PROJECT SOURCE CODE

COPY        ./dist ./dist

#           START SERVER

COPY        --chown=cria:cria ./entrypoint.sh /entrypoint.sh
RUN         chmod +x /entrypoint.sh
ENTRYPOINT  ["/usr/bin/tini", "-g", "--"]
CMD         ["/entrypoint.sh"]
