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
| 3. [Discovery](#3-discovery-and-probing) | Probing, Vulnerability Scanning & Analysis |
| 4. [Business Logic](#4-business-logic) | Burp Testing |
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

## **3. Discovery and Probing**
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
---

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
---
<br>
