#!/bin/zsh
set -e
cd /Users/lyris/Downloads/shili-demo/tools
for s in seg01 seg02 seg03 seg04; do
  echo "=== $s $(date +%T)"
  node $s.mjs
done
echo "=== done $(date +%T)"
