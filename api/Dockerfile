#           BASIC FILE SETUP

FROM        node:22-bookworm-slim AS base

LABEL       author="Isaac Kogan" maintainer="koganisa@yorku.ca"

#           LINUX PACKAGES

RUN         apt update \
            && apt -y install ffmpeg iproute2 git sqlite3 libsqlite3-dev python3 python3-dev ca-certificates dnsutils tzdata zip tar curl build-essential libtool iputils-ping libnss3 tini \
            && useradd -m -d /home/cria cria

#           BUILDER: in-image build so clean-checkout `docker build` works

FROM        base AS builder

USER        cria
ENV         USER=cria HOME=/home/cria
WORKDIR     /home/cria

COPY        --chown=cria:cria package.json package-lock.json ./

# npm ci: reproducible install; fails if package.json and lockfile drift.
RUN         npm ci --no-audit --no-fund

COPY        --chown=cria:cria tsconfig.json tsoa.json ./
COPY        --chown=cria:cria src ./src

RUN         npm run build

FROM        base AS with_packages

#           USER & ENTRYPOINT

USER        cria
ENV         USER=cria HOME=/home/cria
WORKDIR     /home/cria

#           NODE PACKAGES

COPY        package.json package-lock.json ./

# Runtime: production deps only.
RUN         npm ci --omit=dev --no-audit --no-fund

FROM        with_packages AS final

#           PROJECT SOURCE CODE (from builder)

COPY        --chown=cria:cria --from=builder /home/cria/dist ./dist

#           START SERVER

COPY        --chown=cria:cria ./entrypoint.sh /entrypoint.sh
RUN         chmod +x /entrypoint.sh
ENTRYPOINT  ["/usr/bin/tini", "-g", "--"]
CMD         ["/entrypoint.sh"]
