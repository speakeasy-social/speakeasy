#!/bin/bash
set -eux

# Clone and setup atproto
git clone https://github.com/bluesky-social/atproto.git /workspaces/atproto
cd /workspaces/atproto
make deps
make run-dev-env &

# Clone and setup services
git clone https://github.com/speakeasy-social/services.git /workspaces/services 
cd /workspaces/services
pnpm install
pnpm run dev &

# Install main repo dependencies (if any)
cd /workspaces/speakeasy
pnpm install  # Add your actual dependency setup here
