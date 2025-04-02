#!/bin/bash

# Check if all required files exist
if [ ! -f "$1" ] || [ ! -f "$2" ] || [ ! -f "$3" ]; then
    echo "Error: Missing required files"
    exit 1
fi

# Copy files to their destinations
cp "$1" /etc/nginx/sites-available/speakeasy
cp "$2" /etc/nginx/sites-available/default
cp "$3" /etc/nginx/nginx.conf

# Test and reload nginx
if nginx -t; then
    systemctl reload nginx
    exit 0
else
    echo "Nginx configuration test failed. Aborting reload."
    exit 1
fi 