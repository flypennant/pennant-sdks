#!/bin/sh
# Point Cursor and Claude at .agents/skills. Those tool folders stay gitignored.
set -e

root="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$root"

link_skills() {
  dest="$1"
  mkdir -p "$(dirname "$dest")"
  if [ -L "$dest" ] || [ -e "$dest" ]; then
    rm -rf "$dest"
  fi
  ln -sfn ../.agents/skills "$dest"
}

link_skills .cursor/skills
link_skills .claude/skills
