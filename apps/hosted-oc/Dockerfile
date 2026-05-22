FROM docker.io/library/node:22-alpine

WORKDIR /app
ENV OPENCLAW_GATEWAY_BIND=lan
ENV OPENCLAW_GATEWAY_PORT=18789
ENV PORT=18789

COPY server.mjs .

USER node
EXPOSE 18789
CMD ["node", "server.mjs"]
