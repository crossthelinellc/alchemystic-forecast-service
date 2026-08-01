FROM debian:bookworm-slim AS swiss-builder

ARG SWISSEPH_SOURCE_COMMIT=175e1fcb3108bcd5c0d146c803f51dcf23508012
ARG SWISSEPH_DATA_COMMIT=85e65da01dce506bd0ec044ad3e39ab6d144d82b

RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates curl gcc git libc6-dev make \
  && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/aloistr/swisseph.git /usr/src/swisseph \
  && cd /usr/src/swisseph \
  && git checkout "${SWISSEPH_SOURCE_COMMIT}" \
  && make swetest \
  && mkdir -p /opt/swisseph/ephe \
  && cp swetest /opt/swisseph/swetest \
  && for file in sepl_18.se1 semo_18.se1 seas_18.se1; do \
    curl --fail --location --silent --show-error \
      "https://raw.githubusercontent.com/aloistr/swisseph/${SWISSEPH_DATA_COMMIT}/ephe/${file}" \
      --output "/opt/swisseph/ephe/${file}"; \
  done \
  && printf '%s  %s\n' \
    'ca1393ceab3a44fbc895887cf789c68819ae6a1cbc9b22225872dbe4ccd99a66' '/opt/swisseph/ephe/sepl_18.se1' \
    '1ca07bd67c24374d77226180c20a4f9996cba013697894810518e7eb582ca4f7' '/opt/swisseph/ephe/semo_18.se1' \
    'a2cd8fc33807c78ca9a700c91c2e042258b12fc4796519e00781440b5ad8b2e2' '/opt/swisseph/ephe/seas_18.se1' \
    | sha256sum --check --strict

FROM node:24-bookworm-slim

ENV NODE_ENV=production \
  PORT=8787 \
  SWETEST_BIN=/opt/swisseph/swetest \
  SWISSEPH_PATH=/opt/swisseph/ephe

WORKDIR /app

COPY --from=swiss-builder /opt/swisseph /opt/swisseph
COPY integrations/alchemystic-forecast /app/integrations/alchemystic-forecast

USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "integrations/alchemystic-forecast/forecast-service.mjs"]
