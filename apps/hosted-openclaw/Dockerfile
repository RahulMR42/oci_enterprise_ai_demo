FROM docker.io/library/node:22-alpine

WORKDIR /app

ENV OPENCLAW_GATEWAY_BIND=lan
ENV OPENCLAW_GATEWAY_PORT=8080
ENV PORT=8080

COPY server.mjs .

USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
