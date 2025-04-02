#!/bin/bash

# Exit on any error
set -e

# Check if all required files exist
if [ ! -f "$1" ] || [ ! -f "$2" ] || [ ! -f "$3" ]; then
    echo "Error: Missing required files"
    exit 1
fi

# Copy files to their destinations
cp "$1" /etc/nginx/sites-available/speakeasy
cp "$2" /etc/nginx/sites-available/default
cp "$3" /etc/nginx/nginx.conf

# Test nginx configuration
if ! nginx -t; then
    echo "Nginx configuration test failed"
    exit 1
fi

# Reload nginx
if ! systemctl reload nginx; then
    echo "Failed to reload nginx"
    exit 1
fi

exit 0 