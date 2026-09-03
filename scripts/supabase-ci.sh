#!/usr/bin/env bash
#
# Roda um comando do Supabase CLI contra o projeto linkado, tolerando o caso
# "projeto pausado". Usado pelo job `db-sync` do ci.yml e pelo keepalive.yml.
#
# Uso:
#   scripts/supabase-ci.sh db push --yes
#   scripts/supabase-ci.sh migration list --linked
#
# Env obrigatórias: SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF.
# Faltando qualquer uma, sai 0 sem fazer nada — o job fica inerte de propósito
# até os secrets serem configurados (docs/PRODUCTION_CHECKLIST.md §6).
#
# POR QUE A TOLERÂNCIA
# O plano gratuito do Supabase pausa o projeto com ~7 dias de baixa atividade
# no banco. Projeto pausado não é falha de build: nada foi quebrado, e o
# comando entra no próximo push depois de acordar. Sem isso, todo push no
# master fica vermelho enquanto o projeto dorme — foi o que aconteceu entre
# 02/09 e 03/09/2026, em quatro merges seguidos.
#
# Erro de verdade (migration quebrada, credencial inválida) CONTINUA falhando.
# A tolerância cobre exatamente uma condição, e nenhuma outra.
#
# Este arquivo existe para que essa condição seja detectada em UM lugar só. Se
# a Supabase mudar o texto da mensagem, há uma linha a corrigir, não duas em
# workflows diferentes que divergiriam em silêncio.

# Sem `-e`: a falha do comando precisa chegar até a checagem abaixo em vez de
# abortar o script na hora.
set -uo pipefail

readonly PAUSED_PATTERN="project is paused"

if [ "$#" -eq 0 ]; then
  echo "uso: $0 <subcomando do supabase...>" >&2
  exit 2
fi

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ] || [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "ℹ️  Secrets SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF ausentes — etapa pulada."
  echo "   Configure-os no repo para ativar (docs/PRODUCTION_CHECKLIST.md §6)."
  exit 0
fi

out=$(supabase link --project-ref "$SUPABASE_PROJECT_REF" 2>&1 && supabase "$@" 2>&1)
status=$?

echo "$out"

if [ "$status" -ne 0 ]; then
  if echo "$out" | grep -qi "$PAUSED_PATTERN"; then
    # `::warning::` é anotação do GitHub Actions; fora dele, sai como texto.
    echo "::warning::Projeto Supabase pausado — 'supabase $*' adiado. Restaure em https://supabase.com/dashboard"
    exit 0
  fi
  exit "$status"
fi
