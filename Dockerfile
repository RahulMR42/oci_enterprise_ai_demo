FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json requirements.txt ./
RUN python3 -m venv /opt/enterprise-ai-demo-venv \
  && /opt/enterprise-ai-demo-venv/bin/python -m pip install --no-cache-dir --upgrade pip \
  && /opt/enterprise-ai-demo-venv/bin/python -m pip install --no-cache-dir -r requirements.txt

ENV PATH="/opt/enterprise-ai-demo-venv/bin:${PATH}"
ENV HOST=0.0.0.0
ENV PORT=5173
ENV NODE_ENV=production

COPY . .
RUN npm run build

EXPOSE 5173

CMD ["npm", "start"]
