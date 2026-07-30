#!/usr/bin/env bash
#
# check_takeover.sh — triagem de subdomain takeover a partir de um arquivo de CNAMEs
#
# Uso:
#   ./check_takeover.sh hosts.txt
#
# Formato esperado do hosts.txt (um por linha):
#   subdominio.exemplo.com  CNAME_alvo.exemplo.net
#
# Se seu arquivo tiver o formato "cru" do cname.txt (com códigos de cor ANSI),
# rode primeiro:
#   sed -r 's/\x1B\[[0-9;]*[mK]//g' cname.txt | awk '{print $1, $3}' > hosts.txt
#
# Saída:
#   - Para cada host, mostra: CNAME final, se resolve, código HTTP e um trecho do body
#   - Marca com [POSSÍVEL TAKEOVER] quando encontra assinaturas conhecidas de erro
#     de provedores (Azure Web Apps, Traffic Manager, GitHub Pages, etc.)

set -uo pipefail

INPUT="${1:?Uso: $0 hosts.txt}"

# Assinaturas de erro conhecidas por provedor (case-insensitive, grep -i)
declare -A SIGNATURES=(
  ["azurewebsites.net"]="Error 404 - Web app not found|does not exist"
  ["trafficmanager.net"]="unable to resolve profile|not found"
  ["cloudapp.net"]="404 not found"
  ["github.io"]="There isn't a GitHub Pages site here"
  ["herokuapp.com"]="no such app"
  ["azure-api.net"]="not found"
  ["azurefd.net"]="404"
  ["oktapreview.com"]="not found"
  ["cventcustom.com"]="not found"
)

echo "host,cname_final,dns_resolve,http_status,note"

while read -r HOST CNAME _rest; do
  [[ -z "$HOST" || "$HOST" == \#* ]] && continue

  # 1. Segue a cadeia de CNAME até o fim (resposta final do dig)
  FINAL_CNAME=$(dig +short CNAME "$HOST" | tail -1)
  [[ -z "$FINAL_CNAME" ]] && FINAL_CNAME="$CNAME"

  # 2. Tenta resolver IP final (A record) — se vazio, é forte indício de dangling DNS
  RESOLVED_IP=$(dig +short "$HOST" | grep -E '^[0-9]+\.' | tail -1)
  if [[ -z "$RESOLVED_IP" ]]; then
    DNS_STATUS="NAO_RESOLVE"
  else
    DNS_STATUS="resolve:$RESOLVED_IP"
  fi

  # 3. Faz requisição HTTP(S) e captura status + corpo
  HTTP_STATUS=$(curl -s -o /tmp/body.$$ -w "%{http_code}" --max-time 8 -k "https://$HOST" 2>/dev/null)
  BODY=$(cat /tmp/body.$$ 2>/dev/null)
  rm -f /tmp/body.$$

  NOTE=""
  if [[ "$DNS_STATUS" == "NAO_RESOLVE" ]]; then
    NOTE="[POSSIVEL TAKEOVER] CNAME nao resolve (NXDOMAIN/dangling)"
  else
    for provider in "${!SIGNATURES[@]}"; do
      if [[ "$FINAL_CNAME" == *"$provider"* ]]; then
        if echo "$BODY" | grep -Eiq "${SIGNATURES[$provider]}"; then
          NOTE="[POSSIVEL TAKEOVER] assinatura de erro do provedor ($provider)"
        fi
      fi
    done
  fi

  echo "\"$HOST\",\"$FINAL_CNAME\",\"$DNS_STATUS\",\"$HTTP_STATUS\",\"$NOTE\""

done < "$INPUT"
