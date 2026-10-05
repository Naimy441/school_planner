#!/bin/zsh
# Builds "Planner Bar.app" (macOS menu bar companion) with the Swift toolchain.
#   APP_URL=https://your-app.vercel.app ./widget/build.sh
set -euo pipefail
cd "$(dirname "$0")"

APP_URL="${APP_URL:-http://localhost:3000}"
OUT="build/Planner Bar.app"
# Works without accepting the full Xcode license by using the Command Line Tools.
if [[ -z "${DEVELOPER_DIR:-}" && -d /Library/Developer/CommandLineTools ]] && \
   ! xcrun --sdk macosx --show-sdk-path 2>&1 | grep -q '^/'; then
  export DEVELOPER_DIR=/Library/Developer/CommandLineTools
fi
SDK="$(xcrun --sdk macosx --show-sdk-path)"

rm -rf "$OUT"
mkdir -p "$OUT/Contents/MacOS" "$OUT/Contents/Resources"
xcrun swiftc -O -parse-as-library -sdk "$SDK" -target "$(uname -m)-apple-macos13.0" \
  Sources/*.swift -o "$OUT/Contents/MacOS/PlannerBar"
sed "s#__APP_URL__#${APP_URL}#" Info.plist > "$OUT/Contents/Info.plist"

# App icon from the web app's artwork (best effort).
if [[ -f ../public/icon.svg ]] && command -v qlmanage >/dev/null; then
  TMP="$(mktemp -d)"
  qlmanage -t -s 1024 -o "$TMP" ../public/icon.svg >/dev/null 2>&1 || true
  if [[ -f "$TMP/icon.svg.png" ]]; then
    ICONSET="$TMP/AppIcon.iconset"; mkdir -p "$ICONSET"
    for s in 16 32 64 128 256 512; do
      sips -z $s $s "$TMP/icon.svg.png" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
      sips -z $((s*2)) $((s*2)) "$TMP/icon.svg.png" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
    done
    iconutil -c icns "$ICONSET" -o "$OUT/Contents/Resources/AppIcon.icns" 2>/dev/null || true
  fi
  rm -rf "$TMP"
fi

codesign --force --deep --sign - "$OUT" >/dev/null 2>&1 || true
echo "Built $OUT (app URL: $APP_URL)"
echo "Run it:  open \"widget/$OUT\"   — or drag it into /Applications."
