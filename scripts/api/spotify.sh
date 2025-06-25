#!/usr/bin/env bash

set -euo pipefail

base_url="https://developer.spotify.com/reference/web-api/open-api-schema.yaml"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

curl -o "${temp_dir}/openapi.yaml" "${base_url}"

echo "/* eslint @typescript-eslint/no-unused-vars: 0 */" > ./src/domain/spotify.ts

pnpm openapi-gen -s "${temp_dir}/openapi.yaml" >> ./src/domain/spotify.ts
pnpm eslint --fix ./src/domain/spotify.ts
