#!/usr/bin/env sh
set -e

if [ -z "$1" ]; then
  echo "Usage: npm run commit -- \"your commit message\"" >&2
  exit 1
fi

git add .
git commit -m "$1"
git push origin HEAD
