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

Isso inicia um container Postgres em `localhost:5432` com os dados definidos no `docker-compose.yml` (usuário `prodelphus`, banco `prodelphusplus`). Os dados ficam persistidos em um volume Docker entre reinícios.

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

Isso cria a primeira conta admin usando os dados de `apps/api/.env` (por padrão: `admin@prodelphus.com` / `troque-esta-senha`).

> Troque essa senha assim que possível pelo próprio painel de administração do sistema.

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
