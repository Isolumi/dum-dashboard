#!/usr/bin/env bash
set -euo pipefail

host="${1:-yootoob.doh.lumilumi.xyz}"
ssh_host="${SSH_HOST:-dumachine}"

tail_ip="$(ssh "$ssh_host" 'tailscale ip -4')"
lan_ip="$(ssh "$ssh_host" "ip -br -4 address show dev ens18 | tr -s ' ' | cut -d' ' -f3 | cut -d/ -f1")"

curl --fail --silent --show-error --connect-timeout 3 --max-time 5 \
  --resolve "$host:443:$tail_ip" "https://$host/" >/dev/null

if curl --fail --silent --connect-timeout 3 --max-time 5 \
  --resolve "$host:443:$lan_ip" "https://$host/" >/dev/null; then
  printf 'FAIL: %s is reachable through LAN address %s\n' "$host" "$lan_ip" >&2
  exit 1
fi

printf 'PASS: %s works at Tailscale address %s and is blocked at LAN address %s\n' \
  "$host" "$tail_ip" "$lan_ip"
