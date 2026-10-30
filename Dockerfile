FROM node:24-slim
RUN corepack enable
WORKDIR /app
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY --chown=node:node . .
RUN pnpm build && chown -R node:node /app/.next
# The data (tickets, prompts, cache, runs) is mounted at /data, so prompts saved in the browser land in your checkout.
ENV PF_DATA_DIR=/data NODE_ENV=production
USER node
EXPOSE 3000
CMD ["pnpm", "start", "--port", "3000"]
