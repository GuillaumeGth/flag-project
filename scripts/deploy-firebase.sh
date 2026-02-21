#!/bin/bash
# Firebase App Distribution — Deploy script for Fläag
# Usage:
#   ./scripts/deploy-firebase.sh                        → build + distribute
#   ./scripts/deploy-firebase.sh --skip-build <file>   → distribute un APK existant
#   ./scripts/deploy-firebase.sh --notes "Mon message" → avec release notes custom

set -e

# ─── Config ───────────────────────────────────────────────────────────────────
FIREBASE_APP_ID="1:850487950852:android:e48ffe1d9d683ba0667f51"
TESTER_GROUPS="beta-testers"
DEFAULT_NOTES="Build Fläag — $(date '+%Y-%m-%d %H:%M')"

# ─── Arguments ────────────────────────────────────────────────────────────────
SKIP_BUILD=false
APK_PATH=""
RELEASE_NOTES="$DEFAULT_NOTES"

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-build)
      SKIP_BUILD=true
      APK_PATH="$2"
      shift 2
      ;;
    --notes)
      RELEASE_NOTES="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# ─── Vérifications ────────────────────────────────────────────────────────────
if ! command -v firebase &> /dev/null; then
  echo "❌ Firebase CLI non trouvée. Installe-la avec : npm install -g firebase-tools"
  exit 1
fi

if ! firebase projects:list &> /dev/null; then
  echo "❌ Non connecté à Firebase. Lance : firebase login"
  exit 1
fi

# ─── Build ────────────────────────────────────────────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
  echo "🔨 Build Android en cours (EAS local)..."
  cd "$(dirname "$0")/.."
  npx eas build --platform android --local --output ./build-latest.apk
  APK_PATH="./build-latest.apk"
  echo "✅ Build terminé : $APK_PATH"
else
  if [ -z "$APK_PATH" ]; then
    # Cherche le dernier APK à la racine si aucun fichier fourni
    APK_PATH=$(ls -t *.apk 2>/dev/null | head -n 1)
    if [ -z "$APK_PATH" ]; then
      echo "❌ Aucun APK trouvé. Spécifie un fichier avec --skip-build <file.apk>"
      exit 1
    fi
    echo "📦 APK trouvé : $APK_PATH"
  fi
fi

# ─── Distribution ─────────────────────────────────────────────────────────────
echo ""
echo "🚀 Distribution sur Firebase App Distribution..."
echo "   App ID  : $FIREBASE_APP_ID"
echo "   APK     : $APK_PATH"
echo "   Groupes : $TESTER_GROUPS"
echo "   Notes   : $RELEASE_NOTES"
echo ""

firebase appdistribution:distribute "$APK_PATH" \
  --app "$FIREBASE_APP_ID" \
  --groups "$TESTER_GROUPS" \
  --release-notes "$RELEASE_NOTES"

echo ""
echo "✅ Distribution terminée ! Les testeurs reçoivent une notification par email."
