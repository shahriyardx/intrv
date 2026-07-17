FROM oven/bun:1 AS install
WORKDIR /app

COPY package.json bun.lock prisma.config.ts .env ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS build
WORKDIR /app

COPY --from=install /app/node_modules ./node_modules
COPY . .
COPY --from=install /app/src/generated ./src/generated

ENV NODE_ENV=production
RUN bun run build && rm -f .next/standalone/.env

FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/node_modules ./node_modules

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000

USER bun

CMD ["./entrypoint.sh"]
