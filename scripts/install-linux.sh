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

echo "Installed $(basename "$appimage") → $dest"
