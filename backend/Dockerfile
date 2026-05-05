FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev --prefer-offline

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy pre-built dist (compiled on CI/cloud agent, not here)
COPY dist ./dist

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=60s \
  CMD node -e "require('http').get('http://localhost:5000/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
