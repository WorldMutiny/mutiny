#!/usr/bin/env bash
# Install the newest dist/Mutiny-*.AppImage for the current user.
# Extracts the AppImage instead of running it, so FUSE isn't needed, and
# registers a desktop entry so app launchers (e.g. Omarchy's) pick it up.
set -euo pipefail

cd "$(dirname "$0")/.."
appimage=$(ls -t dist/Mutiny-*.AppImage 2>/dev/null | head -1)
[[ -n $appimage ]] || { echo "No AppImage in dist/ — run: npx electron-builder --linux AppImage --x64" >&2; exit 1; }

dest="$HOME/.local/opt/mutiny"
apps="$HOME/.local/share/applications"
icons="$HOME/.local/share/icons"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

(cd "$tmp" && "$OLDPWD/$appimage" --appimage-extract >/dev/null)
rm -rf "$dest"
mkdir -p "$(dirname "$dest")" "$apps" "$icons"
mv "$tmp/squashfs-root" "$dest"
cp "$dest/mutiny.png" "$icons/mutiny.png"

cat > "$apps/mutiny.desktop" <<EOF
[Desktop Entry]
Name=Mutiny
Comment=A distraction-free essay writer
Exec=$dest/mutiny --no-sandbox %U
Terminal=false
Type=Application
Icon=$icons/mutiny.png
StartupWMClass=mutiny
Keywords=writing;writer;essay;article;opinion;research;
Categories=Office;
EOF
update-desktop-database "$apps" 2>/dev/null || true

# On Omarchy: a "Mutiny" row in the Omarchy menu (Super+Alt+Space). The menu
# reads ~/.config/omarchy/extensions/omarchy-menu.jsonc; the row is added
# once and refreshed on later installs, and nothing else in the file changes.
menu="$HOME/.config/omarchy/extensions/omarchy-menu.jsonc"
if [[ -d $HOME/.config/omarchy ]] && command -v python3 >/dev/null; then
  MUTINY_BIN="$dest/mutiny" python3 - "$menu" <<'PY'
import json, os, re, sys
path = sys.argv[1]
row = '  "mutiny": ' + json.dumps({
    "icon": "\U000f03eb",
    "label": "Mutiny",
    "description": "Write an essay",
    "aliases": ["mutiny", "essay", "ensayo"],
    "action": 'omarchy-launch-or-focus mutiny "uwsm-app -- %s --no-sandbox"' % os.environ["MUTINY_BIN"],
}, ensure_ascii=False)
text = open(path, encoding="utf-8").read() if os.path.exists(path) else "{\n}\n"
lines = text.split("\n")
at = [i for i, l in enumerate(lines) if re.match(r'\s*"mutiny"\s*:', l)]
if at:
    lines[at[0]] = row + ("," if lines[at[0]].rstrip().endswith(",") else "")
else:
    end = max(i for i, l in enumerate(lines) if l.strip() == "}")
    # the entry before ours needs a comma; comments and blank lines don't
    prev = next((i for i in range(end - 1, -1, -1) if lines[i].strip() and not lines[i].strip().startswith("//")), None)
    if prev is not None and lines[prev].strip() not in ("{",) and not lines[prev].rstrip().endswith(","):
        lines[prev] = lines[prev].rstrip() + ","
    lines.insert(end, row)
os.makedirs(os.path.dirname(path), exist_ok=True)
open(path, "w", encoding="utf-8").write("\n".join(lines))
PY
  echo "Added Mutiny to the Omarchy menu"
fi

echo "Installed $(basename "$appimage") → $dest"
