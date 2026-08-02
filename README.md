<h1 align="center">Bug Bounty Hunting Methodology 2026</h1>
<h4 align="center">"This bug bounty methodology was developed by me as I start my journey in cybersecurity. It’s a work-in-progress approach that I’m currently following as a beginner."</h4>
<br>

<div align="center">
  
[![LinkedIn](https://img.shields.io/badge/linkedin-%230077B5.svg?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/caetano-rangel/)

</div>
<br>

## 📜 Table of Contents

| Section | Description |
|---------|-------------|
| 1. [Initial Notes](#1-initial-notes-and-create-account) | Initial Notes About Application |
| 2. [Reconnaissance](#2-reconnaissance-and-subdomain-enumeration) | Subdomain Enumeration & Initial Scanning |
| 3. [OWASP 10](#3-OWASP-10) | Probing, Vulnerability Scanning & Analysis |
| 4. [Business Logic](#4-business-logic) | Burp Suit Testing |
| 5. [POC Creation](#5-proof-of-concept-poc-creation) | Documentation & Evidence |
| 6. [Reporting](#6-reporting) | Final Documentation |

---
<br>

## **1. Initial Notes and Create Account**

Antes de iniciar qualquer scan, o entendimento do alvo é fundamental:

*   **Entenda o escopo:** Leia a política do programa (In-Scope vs Out-of-Scope).
*   **Crie contas:** Crie contas de usuário (e de admin, se possível) para testar permissões.
*   **Mapeie funcionalidades:** Identifique onde há login, upload de arquivos, busca, campos de perfil e interações com API.
*   **Anote tecnologias:** Use o [Wappalyzer](https://www.wappalyzer.com/) ou [BuiltWith](https://builtwith.com/) para identificar o stack (tecnologias usadas).

---
<br>

## **2. Reconnaissance and Subdomain Enumeration**

### **2.1 Passive Subdomain Enumeration**
**🛠️Tools:** [Subfinder](https://github.com/projectdiscovery/subfinder), [Alterx](https://github.com/projectdiscovery/alterx)

<br>

**Subfinder**
```bash
subfinder -d target.com -o sub1.txt
```

**sort -u**
```bash
cat * | sort -u > subss.txt
```

**Alterx**
```bash
cat subss.txt | alterx -o alterx.txt
```

### **2.2 Active Subdomain Enumeration**
**🛠️Tools:** [Shuffledns](https://github.com/projectdiscovery/shuffledns), [Naabu](https://github.com/projectdiscovery/naabu), [Httpx](https://github.com/projectdiscovery/httpx)

<br>

**ShuffleDns**
```bash
shuffledns -r ~/resolvers.txt -list sub1.txt -mode resolve -o dns.txt
```

**Naabu**
```bash
cat dns.txt | naabu -top-ports 100 -o naabu.txt
```

**HTTPX**
```bash
httpx -l dns.txt -tech-detect -title -server -cl -sc -mc 200,201,301,302,403 -ports 80,443,8080,8443 -timeout 5 -o live.txt
```

```bash
grep "\[200\]" live.txt > 200.txt
```
---
<br>

## **3. OWASP 10**
**🛠️Tools:** [OpenRedirex](https://github.com/devanshbatham/OpenRedirex)

<br>


**🐞Open Redirect**
```bash
awk '$2 ~ /^\[(200|301|302|303|307|308)\]$/ {print $1}' live.txt > redirects_limpo.txt
```

```bash
katana -u redirects_limpo.txt -d 5 -jc -o katana.txt
```

```bash
katana -list redirects_limpo.txt -d 3 -c 50 -p 20 -jc -mr "(url|redirect|next|return|goto|target|destination|rurl|view)=" -o katana.txt
```

Filtrar para campos que servem como redirect.
```bash
cat katana.txt | gf redirect > gf.txt
```

```bash
grep -E '^https?://([^/]+\.)?target\.[^/]+' gf.txt > gf_filtro.txt
```

```bash
sort -u gf_filtro.txt > gf_unique.txt
```

cd ~/OpenRedirex
```bash
cat ~/gf_unique.txt | python3 openredirex.py > resultados.txt
```

Validação manual com - curl -i target.com

<br>

**🐞XSS**
```bash
awk '{print $1}' live.txt > live_limpo.txt
```

```bash
katana -u live.txt -d 5 -jc -o katana.txt
```

```bash
cat all_urls.txt | uro > all_urls_dedup.txt
```

```bash
cat all_urls_dedup.txt | gf xss > xss_candidatos.txt
```

```bash
cat xss_candidatos.txt | Gxss -p '"><script>alert(1)</script>' -o gxss_out.txt
```

```bash
cat gxss_out.txt | kxss
```

<br>

**🐞Subdomain TakeOver**
```bash
dnsx -l subs.txt -cname -resp -o cname.txt
```

```bash
sed -r 's/\x1B\[[0-9;]*[mK]//g' cname.txt | awk '{print $1, $3}' > hosts.txt
```

```bash
chmod +x check_takeover.sh
```

```bash
./check_takeover.sh hosts.txt > resultado.csv
```

```bash
./final_takeover.sh
```

<br>

**🐞IDOR (Insecure Direct Object Reference)**

*   Mapeie todos os endpoints que recebem um ID (numérico, UUID, hash) — `/api/user/123`, `/invoice?id=456`, `/order/789/details`
*   Crie 2 contas (User A e User B) e troque os IDs entre sessões

```bash
# Extrair todos os parâmetros que parecem IDs
cat all_urls_dedup.txt | grep -E '\?(id|user_id|uid|account|order|invoice|doc)=' > idor_candidatos.txt
```

```bash
# Testar substituição de ID com Burp Intruder ou ffuf autorizado (autenticado)
ffuf -u "https://target.com/api/user/FUZZ" -H "Cookie: session=USERB_TOKEN" -w ids.txt -mc 200
```

*   Teste tanto **incremento numérico** (1, 2, 3...) quanto **IDOR em UUID** (trocar o UUID de outro usuário capturado em algum lugar do app — comentários, avatars, exports)
*   Teste em métodos diferentes: GET, PUT, DELETE, PATCH (BAC + IDOR combinados)

<br>

**🐞SSRF (Server-Side Request Forgery)**

*   Procure funcionalidades que fazem requisições a partir do servidor: importar imagem por URL, webhook, PDF generator, preview de link, integração com API externa

```bash
cat all_urls_dedup.txt | gf ssrf > ssrf_candidatos.txt
```

```bash
# Testar com seu próprio listener (Burp Collaborator, interactsh, ou webhook.site)
curl -X POST https://target.com/api/import -d '{"url":"http://SEU_COLLABORATOR.oastify.com"}'
```

*   Bypass de blacklist de IP interno:
```bash
http://127.0.0.1
http://localhost
http://0.0.0.0
http://[::1]
http://127.1
http://2130706433        (decimal de 127.0.0.1)
http://0x7f000001        (hex de 127.0.0.1)
http://169.254.169.254/latest/meta-data/   (cloud metadata AWS/GCP/Azure)
```

*   Se confirmado, testar acesso a metadata de cloud (AWS/GCP/Azure) para vazamento de credenciais/IAM role

<br>

**🐞Broken Access Control (BAC)**

*   Compare respostas entre usuário autenticado vs não autenticado vs usuário de outro nível de permissão (admin/user/guest)

```bash
# Repetir todas as requisições autenticadas sem cookie/token
curl -i https://target.com/api/admin/users
curl -i -H "Cookie: session=" https://target.com/api/admin/users
```

*   Teste **Forced Browsing** em rotas administrativas comuns:
```bash
/admin
/admin/dashboard
/internal
/api/v1/admin
/manage
/console
```

*   Teste manipulação de role/parâmetro em requisições (`"role":"user"` → `"role":"admin"`, `"isAdmin":false` → `"isAdmin":true`)

<br>

---
<br>

## **4. Business Logic**

Iniciar os testes de endpoints no burp:

*   Entenda qual é o caminho ideal que o usuário deveria seguir (ex: Carrinho --> Pagamento --> Pedido Concluído).

*   Anote regras de negócio sensíveis para testar se é possível realizar ações fora de ordem, reutilizar tokens/cupons, ou manipular valores (como injetar números negativos ou quantidades absurdas).

*   Race Conditions --> Ocorre quando o sistema processa múltiplas requisições simultâneas para a mesma ação antes de atualizar o estado do banco de dados.

*   Esquema do Tomcat.

*   Testar as POCs --> https://github.com/caetano-rangel/POC.
<br>

### **4.1 Spring Boot Actuator**

Módulo de monitoramento do Spring Boot. Quando mal configurado, expõe endpoints internos sem autenticação.

*   Identificar candidatos Filtre hosts que rodam Java/Spring/Tomcat/Jetty (via httpx -tech-detect ou observando headers/erros típicos de stack Java).
*   https://HOST/actuator / https://HOST:8081/actuator / http://HOST/actuator
*   404 / {"status":"NOT_FOUND"} → endpoint desabilitado - 401 / 403 → protegido por auth
*   Taxa de sucesso esperada: Baixa
<br>

### **4.2 Path Traversal (Directory Traversal)**

*   Procure por parâmetros que parecem manipular arquivos/caminhos: ?file= / ?path= / ?name=
*   GET /download?file=../../../../etc/passwd
*   Se o ../ literal for bloqueado, tente bypass de encoding
```bash
..%2f..%2f..%2f..%2fetc%2fpasswd
%2e%2e/%2e%2e/%2e%2e/etc/passwd
....//....//....//etc/passwd
..%252f..%252f..%252fetc%252fpasswd   (dupla URL-encode)
```
<br>

### **4.3 Config Exposure**

```bash
https://HOST/.env
https://HOST/config.json
https://HOST/application.yml
https://HOST/application.properties
https://HOST/web.config
https://HOST/appsettings.json
```
<br>

### **4.4 PostMessage**

Navegador não impõe nenhuma verificação de origem — é responsabilidade de quem escreve o addEventListener checar de onde a mensagem veio (event.origin).

*   Se escreve em innerHTML/document.write → XSS
*   Se redireciona (location.href = event.data.url) → open redirect ou até XSS via javascript
*   Se salva token/dado sensível em localStorage → possível roubo de sessão se você conseguir também ler a resposta
*   Se dispara uma ação (ex: logout(), updateProfile(event.data)) sem confirmar origem → CSRF-like via postMessage

Opção 1 — DevTools (colar script no console)

Opção 2 — Script Node + Puppeteer

```bash
node -v   # confirma que tem Node instalado
npm install puppeteer
npm approve-scripts puppeteer
```

```bash
nano cookies.json
grep "\[200\]" live.txt | awk '{print $1}' > urls.txt
node postmessage_scanner.js urls.txt cookies.json
```

<br>

### **4.5 CORS MissConfig**

Onde procurar:

*   APIs e Endpoints de Dados: Foque em rotas que retornam dados estruturados (/api/v1/..., /graphql, /user/data, /account/settings
*   Requisições via AJAX/Fetch: (F12) na aba Network (Rede) e navegue pela aplicação. Procure por requisições em segundo plano que retornem JSON ou XML.
*   Endpoints com Autenticação: Endpoints que exigem que o usuário esteja logado (ex: extratos, histórico de pedidos, tokens de acesso, configurações de perfil)

O que Verificar:

*   Access-Control-Allow-Origin (ACAO): Indica quais origens têm permissão para ler o resultado.
*   Access-Control-Allow-Credentials (ACAC): Indica se o navegador pode expor a resposta quando credenciais (cookies/tokens) são incluídas. Deve ser estritamente `true`

Como Verificar:

*   Intercepte ou Envie para o Repeater: Pegue uma requisição legítima de API que retorne dados do usuário.
*   Adicione o cabeçalho Origin: `Origin: https://evil.com`
<br>

Cenários:

`Cenário A: Configuração Segura (Não é Bug)`
*   O servidor não retorna o cabeçalho Access-Control-Allow-Origin, ou retorna um domínio específico e confiável (ex: https://app.alvo.com)
*   Conclusão: O navegador bloqueará qualquer tentativa de leitura externa.

`Cenário B: CORS Aberto Público (Geralmente Baixo/Informativo)`
*   Response: Access-Control-Allow-Origin: * | Access-Control-Allow-Credentials: false (ou o cabeçalho nem existe)
*   Conclusão: Como o Credentials é falso ou ausente, sites maliciosos não conseguem roubar dados de sessões autenticadas de usuários específicos.

`Cenário C: O Bug Real (Reflexão Insegura com Credenciais)`
*   Response: Access-Control-Allow-Origin: https://evil.com | Access-Control-Allow-Credentials: true
*   Conclusão: O servidor confia cegamente em qualquer origem que você enviar e permite o envio de cookies. Isso indica uma falha crítica de CORS Misconfiguration.
<br>


### **4.6.1 Web Cache Poisoning**
 
*   Identifique um **unkeyed input** (header/parâmetro que influencia a resposta mas não faz parte da cache key). Use o Param Miner (Burp) para automatizar a descoberta
*   Headers unkeyed clássicos para testar:
```bash
X-Forwarded-Host: teste123.com
X-Forwarded-Scheme: http
X-Original-URL: /
X-Rewrite-URL: /
X-HTTP-Method-Override: GET
X-Forwarded-Proto: http
X-Forwarded-Port: 1337
```
 
```bash
# Enviar sempre com cache-buster único para não poluir o cache compartilhado
curl -i "https://target.com/?cb=849302" -H "X-Forwarded-Host: teste123.com"
```
 
*   Veja se o valor injetado é refletido na resposta (ex: em `<script src="http://teste123.com/...">`, canonical link, meta tag, redirect)
*   Confirme indicadores de cache na resposta:
```bash
Age: 128
X-Cache: HIT
Cache-Control: public, max-age=...
```
 
*   Repita a requisição **sem** o header malicioso (mesmo cache-buster) e veja se o payload envenenado ainda aparece — isso confirma que ficou armazenado
*   Verifique o header `Vary` — ele mostra o que o cache *diz* que usa como chave, e pode divergir do que a origem realmente processa (a divergência é a causa raiz do bug)
*   PoC de impacto: acesse a URL envenenada de uma sessão limpa/anônima/outro IP e confirme que o payload é servido sem enviar o header novamente
<br>

### **4.6.2 Web Cache Deception (WCD)**
 
*   Identifique uma rota **dinâmica e autenticada** que retorna dados sensíveis, ex: `/minhaconta/12345`, `/api/user/profile`, `/doc/12345`
*   Adicione uma extensão estática inexistente ao final do path (não como query string):
```bash
https://target.com/minhaconta/12345/inexistente.css
https://target.com/api/user/profile.js
https://target.com/doc/12345.js
```
 
*   Envie a requisição autenticada (ex: no Burp Repeater) e verifique:
```bash
Status: 200 OK
Cache-Control: public, max-age=...
X-Cache: MISS
```
 
*   Repita a mesma requisição (mesma URL exata) e veja o cache virar `X-Cache: HIT`, confirmando que a resposta dinâmica/sensível foi cacheada como se fosse estática
*   PoC de impacto: acesse a **mesma URL exata**, sem autenticação (sessão limpa/anônima ou de outra conta), e confirme se os dados da vítima aparecem — o vazamento é de **outro usuário**, não um payload seu injetado
*   Cenário de exploração real: force a vítima a acessar a URL manipulada (via link/CSRF/redirect) e, como atacante não autenticado, acesse a mesma URL logo depois para roubar o conteúdo cacheado dela
<br>

---
<br>

