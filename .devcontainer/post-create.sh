#!/bin/bash
set -eux

# FAIL:
# This doesn't work in code spaces because every port is forwarded on a unique
# hostname (why codespaces? why?) which causes CORS errors.
# 
# To make this work, we'd need to configure CORS in ATproto and the services
# to permit *.app.github.dev domains

echo 🚀 Starting Speakeasy playground (this may take a while)
echo
echo

echo
echo 🔧 Building ATproto mock environment
echo

# Clone and setup atproto
git clone https://github.com/bluesky-social/atproto.git ../atproto
cd ../atproto
make deps
pnpm build

echo
echo 🔧 Building Speakeasy services
echo

# Clone and setup services
git clone https://github.com/speakeasy-social/services.git ../services 
cd ../services
pnpm install
pnpm build
pnpm run dev:setup

echo
echo 🚀 Launching ATproto
echo

cd ../atproto
make run-dev-env &

echo
echo 🚀 Launching Speakeasy Services 🤫
echo

cd ../services
pnpm run dev &

echo
echo 🚀 Launching Speakeasy Web 🖥️
echo

cd ../speakeasy
yarn web:dev