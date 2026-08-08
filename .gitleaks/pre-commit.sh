#!/usr/bin/env bash
# ============================================================
# NETSHEET ENGINE — pre-commit hook (gitleaks)
# ============================================================
# Bloqueia commits que contenham segredos ANTES de chegarem ao
# GitHub (defesa em profundidade — o CI também varre cada push/PR).
#
# Instalar (uma vez por clone):
#   Linux/macOS:  ln -s ../../.gitleaks/pre-commit.sh .git/hooks/pre-commit
#   Windows/GitBash (sem Developer Mode p/ symlink): copiar o arquivo:
#     cp .gitleaks/pre-commit.sh .git/hooks/pre-commit
#   Em seguida:  chmod +x .git/hooks/pre-commit
#
# Desinstalar:
#   rm .git/hooks/pre-commit
# ============================================================

set -euo pipefail

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "⚠️  gitleaks não instalado — pule a varredura? [y/N]"
  read -r ans
  if [[ "${ans:-}" != "y" && "${ans:-}" != "Y" ]]; then
    echo "Instale com: curl -sSfL https://raw.githubusercontent.com/zricethezav/gitleaks/master/install.sh | sh"
    exit 1
  fi
  exit 0
fi

# Path do config relativo à raiz do repo (este hook vive em .gitleaks/)
ROOT="$(git rev-parse --show-toplevel)"
CONFIG="$ROOT/.gitleaks.toml"

if [[ ! -f "$CONFIG" ]]; then
  echo "⚠️  .gitleaks.toml não encontrado — varredura ignorada"
  exit 0
fi

echo "🔍 gitleaks: varrendo alterações em stage..."

# --staged: varre apenas o que está prestes a ser commitado
if gitleaks git --staged --config "$CONFIG" --redact --exit-code 1; then
  echo "✅ Nenhum segredo encontrado — commit liberado"
else
  echo "❌ Segredo detectado no stage! Corrija antes de commitar."
  exit 1
fi
