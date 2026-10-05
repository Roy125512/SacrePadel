#!/usr/bin/env bash
# ============================================================
# Sacré Pádel — Setup automático en Mac nueva
# ============================================================
# Qué hace este script:
#   1. Instala Homebrew si no está
#   2. Instala Node.js y Git si no están
#   3. Te pide cada clave de .env.local (las escribes tú, aquí,
#      nunca salen de esta máquina)
#   4. Instala dependencias y verifica que el proyecto compile
#   5. Deja tu identidad de git configurada
#   6. Opcionalmente instala Claude Code
#
# Cómo usarlo (ya con el repo clonado):
#   cd padel-booking
#   chmod +x scripts/setup-mac.sh
#   ./scripts/setup-mac.sh
# ============================================================

set -euo pipefail

section() {
  echo ""
  echo "=== $1 ==="
}

section "Sacré Pádel — Setup en Mac nueva"

# --- 1. Homebrew -------------------------------------------------
if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew no está instalado. Instalando..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Apple Silicon vs Intel paths
  if [ -d /opt/homebrew/bin ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -d /usr/local/bin ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
else
  echo "Homebrew ya está instalado: $(brew --version | head -n1)"
fi

# --- 2. Node.js ----------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js no está instalado. Instalando..."
  brew install node
else
  echo "Node.js ya está instalado: $(node -v)"
fi

# --- 3. Git -----------------------------------------------------------
if ! command -v git >/dev/null 2>&1; then
  echo "Git no está instalado. Instalando..."
  brew install git
else
  echo "Git ya está instalado: $(git --version)"
fi

# --- 4. Variables de entorno (.env.local) -------------------------------
section "Variables de entorno (.env.local)"
echo "Voy a pedirte cada valor. Sácalos de los paneles del propio proyecto"
echo "(no de tu cuenta personal):"
echo "  - Supabase -> Project Settings -> API"
echo "  - Mercado Pago -> Credenciales"
echo "  - Tu proveedor de correo (SMTP)"
echo "Si quieres dejar alguno vacío por ahora, solo presiona Enter."
echo ""

ask() {
  local prompt="$1"
  local value
  read -r -p "$prompt: " value
  echo "$value"
}

SUPABASE_URL=$(ask "NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON_KEY=$(ask "NEXT_PUBLIC_SUPABASE_ANON_KEY")
SUPABASE_SRV_KEY=$(ask "SUPABASE_SERVICE_ROLE_KEY")
MP_TOKEN=$(ask "MERCADOPAGO_ACCESS_TOKEN")
MP_WEBHOOK=$(ask "MERCADOPAGO_WEBHOOK_SECRET")
SMTP_HOST=$(ask "SMTP_HOST")
SMTP_PORT=$(ask "SMTP_PORT")
SMTP_SECURE=$(ask "SMTP_SECURE (true/false)")
SMTP_USER=$(ask "SMTP_USER")
SMTP_PASS=$(ask "SMTP_PASS")
SMTP_FROM=$(ask "SMTP_FROM")
NOTIFY_EMAIL=$(ask "NOTIFY_EMAIL")

cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SRV_KEY
MERCADOPAGO_ACCESS_TOKEN=$MP_TOKEN
MERCADOPAGO_WEBHOOK_SECRET=$MP_WEBHOOK
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_SECURE=$SMTP_SECURE
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
SMTP_FROM=$SMTP_FROM
NOTIFY_EMAIL=$NOTIFY_EMAIL
NEXT_PUBLIC_SITE_URL=https://sacrepadel.com
NEXT_PUBLIC_DEMO_MODE=false
EOF

echo ".env.local creado."

# --- 5. Instalar dependencias -----------------------------------------
section "Instalando dependencias"
npm install

# --- 6. Verificar TypeScript -------------------------------------------
section "Verificando TypeScript"
npx tsc --noEmit -p tsconfig.json
echo "TypeScript compiló sin errores."

# --- 7. Identidad de git -------------------------------------------------
section "Identidad de git"
read -r -p "Tu nombre para los commits (Enter para omitir): " GIT_NAME
read -r -p "Tu correo para los commits (Enter para omitir): " GIT_EMAIL
[ -n "$GIT_NAME" ] && git config user.name "$GIT_NAME"
[ -n "$GIT_EMAIL" ] && git config user.email "$GIT_EMAIL"

# --- 8. Claude Code opcional -----------------------------------------------
section "Claude Code (opcional)"
read -r -p "¿Instalar Claude Code en esta Mac también? (s/n): " INSTALL_CLAUDE
if [ "$INSTALL_CLAUDE" = "s" ]; then
  npm install -g @anthropic-ai/claude-code
  echo "Claude Code instalado. Corre 'claude' dentro de esta carpeta y haz /login."
fi

section "Listo"
echo "Proyecto en: $(pwd)"
echo "Para arrancar el servidor de desarrollo: npm run dev"
echo "La primera vez que hagas 'git push' o 'git pull' te va a pedir iniciar sesión en GitHub por el navegador."
