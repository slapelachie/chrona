# syntax=docker.io/docker/dockerfile:1

ARG NODE_ENV=production
ARG NEXT_TELEMETRY_DISABLED=1
ARG PORT=3000
ARG TZ=UTC

FROM node:20-alpine AS base
ARG TZ
ENV TZ=${TZ}
RUN apk add --no-cache libc6-compat tzdata
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi


# Rebuild the source code only when needed
FROM base AS builder
ARG NEXT_TELEMETRY_DISABLED
ENV NEXT_TELEMETRY_DISABLED=${NEXT_TELEMETRY_DISABLED}
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Production image, copy all the files and run next
FROM base AS runner
ARG NODE_ENV
ARG NEXT_TELEMETRY_DISABLED
ARG PORT
ARG TZ
ENV NODE_ENV=${NODE_ENV}
ENV NEXT_TELEMETRY_DISABLED=${NEXT_TELEMETRY_DISABLED}
ENV PORT=${PORT}
ENV TZ=${TZ}

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

COPY docker/start.sh ./start.sh
RUN chmod +x ./start.sh

USER nextjs

EXPOSE ${PORT}

CMD ["./start.sh"]
