#!/bin/bash
# Firebase App Distribution — Deploy script iOS pour Fläag
# Usage:
#   ./scripts/deploy-firebase-ios.sh                        → build + distribute
#   ./scripts/deploy-firebase-ios.sh --skip-build <file>   → distribue un IPA existant
#   ./scripts/deploy-firebase-ios.sh --notes "Mon message" → avec release notes custom

set -e

# ─── Config ───────────────────────────────────────────────────────────────────
FIREBASE_APP_ID="1:850487950852:ios:2dfc8809c1961cfa667f51"
TESTER_GROUPS="beta-testers"
DEFAULT_NOTES="Build Fläag iOS — $(date '+%Y-%m-%d %H:%M')"

# ─── Arguments ────────────────────────────────────────────────────────────────
SKIP_BUILD=false
IPA_PATH=""
RELEASE_NOTES="$DEFAULT_NOTES"

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-build)
      SKIP_BUILD=true
      IPA_PATH="$2"
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
  echo "🔨 Build iOS en cours (EAS cloud, profil preview)..."
  cd "$(dirname "$0")/.."

  # EAS cloud build — génère un .ipa signé en ad-hoc
  BUILD_OUTPUT=$(npx eas build --platform ios --profile preview --non-interactive --json 2>/dev/null)
  BUILD_ID=$(echo "$BUILD_OUTPUT" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data[0]['id'] if isinstance(data,list) else data['id'])" 2>/dev/null || echo "")

  if [ -z "$BUILD_ID" ]; then
    echo "❌ Impossible de récupérer l'ID du build EAS."
    echo "   Assure-toi d'être connecté : npx eas login"
    exit 1
  fi

  echo "⏳ Build EAS en cours (ID: $BUILD_ID)..."
  echo "   Suivi : https://expo.dev/accounts/guillaumed.gth/projects/flag-app/builds/$BUILD_ID"

  # Attente de completion
  while true; do
    STATUS=$(npx eas build:view "$BUILD_ID" --json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','UNKNOWN'))" 2>/dev/null || echo "UNKNOWN")
    if [ "$STATUS" = "FINISHED" ]; then
      break
    elif [ "$STATUS" = "ERRORED" ] || [ "$STATUS" = "CANCELLED" ]; then
      echo "❌ Build échoué (status: $STATUS)"
      exit 1
    fi
    echo "   Status: $STATUS — attente 30s..."
    sleep 30
  done

  # Téléchargement du .ipa
  IPA_URL=$(npx eas build:view "$BUILD_ID" --json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('artifacts',{}).get('buildUrl',''))" 2>/dev/null || echo "")

  if [ -z "$IPA_URL" ]; then
    echo "❌ URL du .ipa introuvable dans le build EAS."
    exit 1
  fi

  IPA_PATH="./build-latest.ipa"
  echo "📥 Téléchargement du .ipa..."
  curl -L -o "$IPA_PATH" "$IPA_URL"
  echo "✅ Build terminé : $IPA_PATH"
else
  if [ -z "$IPA_PATH" ]; then
    # Cherche le dernier IPA à la racine si aucun fichier fourni
    IPA_PATH=$(ls -t *.ipa 2>/dev/null | head -n 1)
    if [ -z "$IPA_PATH" ]; then
      echo "❌ Aucun IPA trouvé. Spécifie un fichier avec --skip-build <file.ipa>"
      exit 1
    fi
    echo "📦 IPA trouvé : $IPA_PATH"
  fi
fi

# ─── Distribution ─────────────────────────────────────────────────────────────
echo ""
echo "🚀 Distribution sur Firebase App Distribution..."
echo "   App ID  : $FIREBASE_APP_ID"
echo "   IPA     : $IPA_PATH"
echo "   Groupes : $TESTER_GROUPS"
echo "   Notes   : $RELEASE_NOTES"
echo ""

firebase appdistribution:distribute "$IPA_PATH" \
  --app "$FIREBASE_APP_ID" \
  --groups "$TESTER_GROUPS" \
  --release-notes "$RELEASE_NOTES"

echo ""
echo "✅ Distribution terminée ! Les testeurs reçoivent une notification par email."
