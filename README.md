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
subfinder -d target.com -o subs_1.txt
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
shuffledns -r ~/resolvers.txt -list subs_1.txt -mode resolve -o dns.txt
```

**Naabu**
```bash
cat dns.txt | naabu -top-ports 100 -o naabu.txt
```

**HTTPX**
```bash
cat naabu.txt | httpx -title -cl -sc -mc 200,201,301,302,302,403 -ports 80,443,8080,8443 -o live.txt
```
---
<br>

## **3. Discovery and Probing**
**🛠️Tools:** [OpenRedirex](https://github.com/devanshbatham/OpenRedirex)

<br>


**🐞Open Redirect**
```bash
grep -E "\b(200|301|302|303|307|308)\b" live.txt > redirects.txt
```

```bash
awk '{print $1}' redirects.txt > redirects_limpo.txt
```

```bash
katana -u redirects_limpo.txt -d 5 -jc -o katana.txt
```

```bash
katana -list redirects_limpo.txt -d 3 -c 50 -p 20 -jc -mr "(url|redirect|next|return|goto|target|destination|rurl|view)=" -o katana.txt
```

```bash
cat live.txt | sed 's|https\?://||' | xargs -P 10 -I {} gau --threads 5 {} >> gau.txt
```

```bash
cat katana.txt gau.txt | sort -u > all_urls.txt
```

Filtrar para campos que servem como redirect.
```bash
cat all_urls.txt | gf redirect > gf_hits.tx
```
```bash
cat all_urls.txt | grep -iE '(landing|eurl|dest|callback|forward|goto|url|redirect|next|return|goto|target|destination|rurl|view)=' >> gf_hits.txt
```

```bash
sort -u gf_hits.txt > gf_hits_unique.txt
```

cd ~/OpenRedirex
```bash
cat ~/gf_hits_unique.txt | python3 openredirex.py > resultados.txt
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
cat cname.txt | grep -iE 'github\.io|herokuapp\.com|s3\.amazonaws\.com|s3-website|azurewebsites\.net|cloudfront\.net|myshopify\.com|zendesk\.com|bitbucket\.io|wordpress\.com|fastly\.net|pantheon\.io|surge\.sh|helpjuice\.com|desk\.com|statuspage\.io|unbouncepages\.com' > takeover.txt
```

```bash
subzy run --targets takeover.txt --hide_fails --https --verify_ssl
```

```bash
curl -sv https://www.target.com 2>&1 | head -40
```
<br>

## **4. Business Logic**

Antes de iniciar qualquer scan, o entendimento do alvo é fundamental:

*   **Entenda o escopo:** Leia a política do programa (In-Scope vs Out-of-Scope).
*   **Crie contas:** Crie contas de usuário (e de admin, se possível) para testar permissões.
*   **Mapeie funcionalidades:** Identifique onde há login, upload de arquivos, busca, campos de perfil e interações com API.

---
<br>
