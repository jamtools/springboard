FROM mcr.microsoft.com/devcontainers/javascript-node:20

RUN sudo apt-get update && sudo apt-get install -y libasound2-dev git-lfs
RUN git lfs install

ENV PNPM_HOME=/workspaces/pnpm

RUN corepack enable pnpm

COPY pnpm-lock.yaml ./

RUN pnpm fetch
