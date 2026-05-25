FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache python3 py3-pip

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY requirements.txt ./
RUN python3 -m venv /app/env \
  && /app/env/bin/python -m pip install --no-cache-dir -r requirements.txt

COPY index.html server.mjs bash.sh ./
COPY src ./src
COPY backend ./backend
COPY docs/wiring ./docs/wiring

ENV HOST=0.0.0.0
ENV PORT=5173
ENV PYTHONUNBUFFERED=1

EXPOSE 5173

CMD ["npm", "start"]
