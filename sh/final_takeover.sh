#!/usr/bin/env bash
#
# check_takeover.sh
# Verifica candidatos a subdomain takeover (CNAME dangling) e gera um
# relatorio resumido em Markdown.
#
# Uso:
#   ./final_takeover.sh                 -> usa a lista padrao embutida
#   ./final_takeover.sh hosts.txt       -> usa uma lista customizada (1 host por linha)
#
# Requisitos: dig, curl

set -uo pipefail

OUTPUT="relatorio_takeover_$(date +%Y%m%d_%H%M%S).txt"

# Lista padrao extraida do resultado.csv (hosts marcados como possivel takeover)
DEFAULT_HOSTS=(
  "target.com"
)

if [[ -n "${1:-}" && -f "$1" ]]; then
  mapfile -t HOSTS < "$1"
else
  HOSTS=("${DEFAULT_HOSTS[@]}")
fi

echo "# Relatorio de verificacao - Subdomain Takeover" > "$OUTPUT"
echo "" >> "$OUTPUT"
echo "Gerado em: $(date)" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "| Host | CNAME | Resolve (1.1.1.1) | Resolve (8.8.8.8) | HTTP Status | Veredito |" >> "$OUTPUT"
echo "|---|---|---|---|---|---|" >> "$OUTPUT"

for host in "${HOSTS[@]}"; do
  host=$(echo "$host" | tr -d '\r' | xargs) # limpa espacos/CR
  [[ -z "$host" ]] && continue

  echo ">> Verificando $host ..."

  cname=$(dig +short CNAME "$host" | head -n1)
  [[ -z "$cname" ]] && cname="(sem CNAME / A direto)"

  resolve_cf1=$(dig +short @1.1.1.1 "$host" | head -n1)
  resolve_cf2=$(dig +short @8.8.8.8 "$host" | head -n1)

  [[ -z "$resolve_cf1" ]] && resolve_cf1="NXDOMAIN/vazio"
  [[ -z "$resolve_cf2" ]] && resolve_cf2="NXDOMAIN/vazio"

  http_status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 8 "https://$host/" 2>/dev/null)
  [[ -z "$http_status" || "$http_status" == "000" ]] && http_status="erro_conexao"

  # Veredito automatico simples
  if [[ "$resolve_cf1" == "NXDOMAIN/vazio" && "$resolve_cf2" == "NXDOMAIN/vazio" ]]; then
    veredito="⚠️ AINDA DANGLING - investigar reivindicacao"
  else
    veredito="OK / ja resolve (possivelmente corrigido)"
  fi

  echo "| $host | $cname | $resolve_cf1 | $resolve_cf2 | $http_status | $veredito |" >> "$OUTPUT"
done

echo "" >> "$OUTPUT"
echo "## Observacoes" >> "$OUTPUT"
echo "" >> "$OUTPUT"
cat >> "$OUTPUT" << 'EOF'
- "AINDA DANGLING" significa que o CNAME nao resolveu em dois resolvers publicos
  diferentes (Cloudflare e Google). Isso e um forte indicio, mas NAO prova
  takeover sozinho.
- Para confirmar de verdade, o proximo passo manual e tentar cadastrar o
  dominio como "Alternate Domain Name (CNAME)" em uma distribuicao CloudFront
  na sua propria conta AWS. Se a AWS nao acusar erro de "CNAMEAlreadyExists",
  o alias esta livre e o takeover e possivel.
- Hosts como "assets.linktr.ee" (CNAME para *.acm-validations.aws) NAO sao
  takeovers exploraveis - sao registros de validacao de certificado, nao
  servicos reivindicaveis. Reporte apenas como CNAME orfao/DNS hygiene, se o
  programa aceitar esse tipo de achado.
- Sempre confira o escopo do programa de bounty antes de reportar
  (subdominios *.qa.* costumam ter regras proprias).
EOF

echo ""
echo "Relatorio salvo em: $OUTPUT"
