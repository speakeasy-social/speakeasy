FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Install essential tools
RUN apt-get update && apt-get install -y \
    make \
    gcc \
    git-lfs \
    pnpm

# Install Go (if needed)
RUN apt-get install -y golang-go

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - && \
    apt-get install -y nodejs
