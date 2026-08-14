# Pro Delphus+

Sistema interno da Pro Delphus para gestão de tabela de preços, produtos e geração automática de orçamentos em PDF.

**Stack**: React + Vite + TypeScript + Tailwind CSS (frontend) · Express + TypeScript + Prisma (backend) · PostgreSQL.

## Pré-requisitos

Antes de começar, tenha instalado:

- [Node.js](https://nodejs.org/) 20 ou superior (testado com Node 22)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (para rodar o Postgres localmente)
- npm (já vem com o Node)

Verifique as versões:

```bash
node --version
npm --version
docker --version
```

## Passo a passo

### 1. Instalar as dependências

Na raiz do projeto (este é um monorepo com npm workspaces — um único `npm install` resolve o frontend, o backend e os pacotes compartilhados):

```bash
npm install
```

### 2. Configurar as variáveis de ambiente

O backend precisa de um arquivo `.env`. Já existe um `apps/api/.env.example` com valores padrão prontos para desenvolvimento local:

```bash
cp apps/api/.env.example apps/api/.env
```

Abra `apps/api/.env` e, se quiser, ajuste os segredos de JWT e a senha do admin inicial (para desenvolvimento local os valores padrão já funcionam).

### 3. Subir o banco de dados (Postgres via Docker)

```bash
npm run db:up
```

Isso inicia um container Postgres em `localhost:5433` (porta 5433 no host para não colidir com um Postgres já instalado na máquina) com os dados definidos no `docker-compose.yml` (usuário `prodelphus`, banco `prodelphusplus`). Os dados ficam persistidos em um volume Docker entre reinícios.

Para derrubar o banco depois:

```bash
npm run db:down
```

### 4. Rodar as migrations e criar as tabelas

```bash
npm run prisma:migrate
```

Isso aplica o schema (`apps/api/prisma/schema.prisma`) no banco e gera o client do Prisma.

### 5. Criar o usuário administrador inicial

```bash
npm run prisma:seed
```

Isso cria a primeira conta admin com os dados de `apps/api/.env`. **`ADMIN_SEED_PASSWORD` não tem valor padrão** — preencha com pelo menos 10 caracteres antes de rodar, senão o seed recusa.

> Não existe recuperação de senha por e-mail. Quem esquece a senha pede a um admin, que define uma nova em **Administração → Contas**.

### 6. Rodar o backend e o frontend

Em dois terminais separados:

```bash
# Terminal 1 — API (http://localhost:4000)
npm run dev:api

# Terminal 2 — Frontend (http://localhost:5173)
npm run dev:web
```

O frontend já está configurado para redirecionar as chamadas `/api` e `/uploads` para a API em `localhost:4000` (veja `apps/web/vite.config.ts`), então basta acessar:

```
http://localhost:5173
```

e fazer login com a conta admin criada no passo 5.

## Resumo dos comandos (depois da primeira configuração)

No dia a dia, depois de tudo já configurado uma vez, basta:

```bash
npm run db:up      # sobe o Postgres (se não estiver rodando)
npm run dev:api    # em um terminal
npm run dev:web    # em outro terminal
```

## Deploy em produção

Tudo em contêiner: Postgres, API (com Chromium para os PDFs), nginx servindo o front e fazendo proxy, e um serviço de backup diário.

### 1. Preencher as variáveis

```bash
cp .env.prod.example .env.prod
```

Gere cada segredo — a API **se recusa a subir** com segredo curto ou com valor de exemplo:

```bash
openssl rand -base64 48   # JWT_ACCESS_SECRET
openssl rand -base64 48   # JWT_REFRESH_SECRET
openssl rand -base64 32   # POSTGRES_PASSWORD
```

Ajuste `PUBLIC_URL` para o endereço real (vira o `CORS_ORIGIN` da API) e `ADMIN_SEED_PASSWORD` com no mínimo 10 caracteres.

### 2. Onde os dados ficam guardados

Por padrão, o Docker guarda tudo (imagens, volumes) em `/var/lib/docker`. Se essa pasta estiver na mesma partição do sistema operacional, o banco de dados e os arquivos enviados (fotos, PDFs) crescem ali dentro e podem, um dia, lotar o disco do próprio SO.

Este projeto evita isso: os dois volumes (`postgres_data`, `uploads_data`) são amarrados a um diretório explícito no host, via a variável `DATA_ROOT`. Configure-a em `.env.prod` apontando para um disco/partição **separado** do sistema operacional (ex.: `/data/prodelphusplus`), montado antes deste passo.

```bash
# Ajuste DATA_ROOT no .env.prod primeiro, depois:
mkdir -p "$DATA_ROOT"/postgres "$DATA_ROOT"/uploads
```

**Esse `mkdir` é obrigatório antes do primeiro `up`** — o Docker não cria essas pastas sozinho; se elas não existirem, a subida falha com um erro de "no such file or directory" ao montar o volume.

Sem `DATA_ROOT` definida, o padrão é `./data` — uma pasta dentro do próprio projeto, útil só para testar localmente. Não use o padrão em produção: o objetivo inteiro é sair da partição do sistema.

> A pasta de backups (`./backups`) e o próprio código clonado do repositório **não** são cobertos por `DATA_ROOT` — eles ficam onde o repositório for clonado no servidor. Se quiser tudo fora da partição do SO, clone o projeto inteiro dentro do disco separado (ex.: `/data/prodelphusplus/app`), não em `/root` ou `/home`.

### 3. Subir

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

As migrações rodam sozinhas a cada subida, antes de a API aceitar tráfego. Só o nginx publica porta (`HTTP_PORT`, padrão 8080); Postgres e API ficam na rede interna.

### 4. Criar o primeiro admin (só na primeira vez)

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec api \
  node apps/api/dist/prisma/seed.js
```

### 5. HTTP, por enquanto

O sistema roda em **HTTP puro** — decisão consciente para uso interno, com acesso pela rede local ou VPN e um time pequeno e conhecido. Duas coisas garantem que isso funcione direito, já configuradas no compose:

- `COOKIE_SECURE=false`. **Isso não é cosmético**: o cookie de sessão com a flag `Secure` é descartado pelos navegadores em conexões não criptografadas (exceto `localhost`), e sem essa flag desligada o login para de persistir entre recarregamentos.
- O HSTS fica desligado junto — anunciar "só me acesse por HTTPS" num sistema servido por HTTP trancaria o acesso de todos.
- A API imprime um aviso na subida lembrando que senha e sessão trafegam legíveis na rede.

O que se abre mão: quem estiver no caminho da rede consegue ler senha e token de sessão, e o Chrome mostra "Não seguro" ao lado do campo de senha. Aceitável em rede fechada; se o acesso mudar (rede aberta, exposição externa), revisitar isso antes.

### 6. Trocar o número inicial dos pedidos

O número do primeiro pedido ("Pedido #0000", "Pedido #2801" etc.) vem da variável `ORDER_NUMBER_START` (padrão: `0`, exibido com 4 dígitos). A partir do primeiro pedido, o próximo número é sempre `último + 1` — a variável só é lida quando a tabela `orders` está **vazia**.

Para mudar (ex.: quando você souber qual foi o último número de invoice emitido fora da plataforma):

1. Edite `ORDER_NUMBER_START` em `.env.prod` (produção) ou `apps/api/.env` (local).
2. Confirme que não existe nenhum pedido no banco ainda — se já existir algum, o valor novo não tem efeito até a tabela `orders` ser esvaziada.
3. Reinicie a API:
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build api
   ```

## Backup e restauração

O serviço `backup` roda todo dia e grava em `./backups/`:

- `db-AAAAMMDD-HHMMSS.sql.gz` — dump do Postgres
- `uploads-AAAAMMDD-HHMMSS.tar.gz` — PDFs, invoices, fotos e assinaturas

Guarda só os `BACKUP_KEEP_COUNT` mais recentes de cada tipo (padrão: **2**) — o mais antigo é apagado assim que um novo backup completa com sucesso. O expurgo só roda depois do backup do dia ter sido gravado inteiro, então uma falha não apaga os anteriores.

> **Isso é backup local.** Se a máquina morrer, morre com ela. Configure uma cópia diária de `./backups/` para fora — `rclone`, `aws s3 sync` ou `rsync` para outro host. Sem isso, metade do problema continua de pé.

Para restaurar (destrutivo, pede confirmação):

```bash
./scripts/restore.sh backups/db-20260807-030000.sql.gz \
                     backups/uploads-20260807-030000.tar.gz
```

Use sempre o par do **mesmo carimbo de tempo**: o banco guarda o caminho do PDF e o arquivo vive no volume de uploads. Misturar as duas pontas produz orçamento apontando para arquivo inexistente.

Backup manual, fora da rotina:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backup /usr/local/bin/backup.sh
```

## Segurança

- Arquivos de `/uploads` (orçamentos, invoices, fotos, assinaturas) exigem sessão ativa — os nomes são sequenciais e, sem isso, bastaria contar números para baixar o histórico comercial inteiro
- `helmet` nos cabeçalhos e limite de corpo de 1 MB nas rotas JSON
- Login e cadastro: 10 tentativas malsucedidas a cada 10 minutos por IP (acerto não gasta cota); 300 req/min por IP no resto da API
- Segredos JWT com 32+ caracteres exigidos quando `NODE_ENV=production`
- A API roda sem privilégio no contêiner; o root é usado só para aplicar migração na subida
- Sem recuperação de senha por e-mail: redefinição é feita por um admin, em Administração → Contas

## Estrutura do projeto

```
prodelphusplus/
├── apps/
│   ├── web/              # Frontend — React + Vite + Tailwind
│   └── api/               # Backend — Express + Prisma
│       ├── prisma/         # schema.prisma, migrations, seed
│       ├── src/
│       │   ├── routes/      # rotas da API (auth, users, price-table, products, quotes...)
│       │   ├── middleware/  # autenticação, tratamento de erros
│       │   ├── lib/         # prisma client, jwt, pdf, dto
│       │   └── storage/     # upload/armazenamento de arquivos
│       └── uploads/         # arquivos enviados (mídia de produtos, PDFs de orçamento)
├── packages/
│   └── shared/            # tipos TypeScript compartilhados entre web e api
└── docker-compose.yml     # Postgres para desenvolvimento
```

## Solução de problemas

**"Cannot connect to the Docker daemon"** — o Docker Desktop precisa estar aberto. Abra o app Docker Desktop e espere o ícone da baleia ficar estável antes de rodar `npm run db:up` de novo.

**Erro de conexão com o banco ao rodar `prisma:migrate`** — confirme que o container do Postgres está de pé com `docker ps` e que a `DATABASE_URL` em `apps/api/.env` bate com o `docker-compose.yml`.

**Porta 4000 ou 5173 já em uso** — pare o processo que está usando a porta, ou altere `PORT` em `apps/api/.env` (backend) / a porta do Vite em `apps/web/vite.config.ts` (frontend, lembrando de ajustar o proxy também).

**Geração de PDF falhando** — a primeira geração de orçamento pode demorar alguns segundos porque o Puppeteer baixa/inicializa um Chromium headless na primeira execução. Se falhar, rode `npx puppeteer browsers install chrome` dentro de `apps/api`.

**Não consigo logar / o site trava em "Carregando..." / erro de conexão** — antes de desconfiar da senha, confirme se o servidor não caiu. O terminal onde `npm run dev:api` (ou `npm run dev:web`) estava rodando pode ter sido fechado, travado, ou o processo pode ter morrido sozinho. Para verificar:

```bash
# O processo da API ainda está de pé?
ps aux | grep "src/index.ts"

# A API está respondendo? (deve retornar algum código HTTP, não erro de conexão)
curl -i http://localhost:4000/api/auth/me
```

Se não aparecer nenhum processo, ou o `curl` der erro de conexão (`Failed to connect` / `Connection refused`), o servidor caiu — é só subir de novo:

```bash
npm run dev:api    # em um terminal
npm run dev:web    # em outro, se o frontend também tiver caído
```

> **Por que isso acontece com frequência em desenvolvimento local**: `npm run dev:api`/`dev:web` rodam em processos comuns de terminal, sem nenhum supervisor que os reinicie sozinho se caírem (por fechar o terminal, o computador dormir, falta de memória, etc.). Isso é esperado em ambiente de desenvolvimento e não indica um bug no código — não precisa investigar cada vez, só suba de novo. Em produção isso não acontece, porque lá o processo roda sob um supervisor (ex: `pm2`, systemd, ou o próprio orquestrador da hospedagem escolhida) que reinicia automaticamente se cair.

Confirme também que o Postgres continua de pé (`docker compose ps` deve mostrar o container `prodelphusplus-postgres` como `Up`/`healthy`) — se ele caiu junto, suba com `npm run db:up` antes de reiniciar a API.
