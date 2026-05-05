FROM node:20-alpine AS builder

WORKDIR /app

# Build args — passed in from docker-compose or CI
ARG REACT_APP_API_URL=http://localhost:5000/api
ARG REACT_APP_WS_URL=http://localhost:5000

ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_WS_URL=$REACT_APP_WS_URL
ENV SKIP_PREFLIGHT_CHECK=true
ENV NODE_ENV=production
ENV GENERATE_SOURCEMAP=false

COPY package*.json ./
RUN npm ci --prefer-offline

COPY . .
RUN NODE_OPTIONS="--max-old-space-size=384" npm run build

# ─── Production nginx ───────────────────────────────────────────────────────
FROM nginx:1.25-alpine

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx-frontend.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
