# Pro Delphus+

Sistema interno da Pro Delphus para gestão de tabela de preços, produtos e geração automática de orçamentos em PDF.

**Stack**: React + Vite + TypeScript + Tailwind CSS (frontend) · Express + TypeScript + Prisma (backend) · PostgreSQL.

## Funcionalidades

O que cada área do sistema faz e as regras de negócio por trás dela.

### Catálogo de produtos

- Cadastro com SKU, nome, descrição (inglês e português), lista de componentes, setores/áreas médicas (um produto pode pertencer a vários), links de vídeo e tipo — **Modelo completo** ou **Componente/peça avulsa**.
- Preço em até quatro colunas independentes: **BRL**, **USD final**, **USD distribuidor** e **EUR**. Qualquer uma pode ficar em branco — um produto sem preço numa moeda simplesmente não pode ser orçado nela, mas continua visível no catálogo.
- Peso (kg) por produto, usado depois no Documento de Exportação do pedido.
- Mídia (fotos e documentos) por produto, com uma imagem marcada como principal — é ela que entra no orçamento; reordenável e substituível.
- Brochuras (PDFs) anexadas por produto, para download.
- Customizações: campos de opção livre por produto (ex.: "Cor" → "Azul, Vermelho, Verde").
- Busca por texto livre (SKU, nome, setor, descrição) e filtro por tipo/setor.
- Excluir um produto já usado em algum orçamento não apaga de verdade — o sistema o desativa, preservando os orçamentos que o referenciam.

### Tabela de preços

- Catálogo agrupado por setor, com todas as moedas/tabelas lado a lado.
- Colunas configuráveis (descrição, componentes, cada moeda) — a escolha fica salva no navegador.
- Exportação em PDF com os mesmos filtros aplicados na tela.
- Idioma de exibição (nome do setor, descrição do produto) segue o idioma do catálogo configurado em Minha Conta.

### Clientes

- Cadastro com tipo (**Pessoa física**, **Instituição** ou **Distribuidor**), instituição/hospital vinculado, contatos, CNPJ/Tax ID, site e endereço.
- Endereço de cobrança e de entrega guardados como texto pronto (`billToText`/`shipToText`) — evita redigitar isso a cada pedido de exportação; é o que alimenta o Invoice e a Packing List automaticamente.
- Setores de interesse do cliente, usados para casar com o catálogo — inclusive pelo NEO, ao buscar produtos "pra essa área".
- Marcação manual de **"em atendimento"**, independente do cadastro estar ativo — é o sinalizador de quem está sendo trabalhado agora comercialmente.
- Ficha do cliente mostra todo o histórico: orçamentos e pedidos gerados, total cotado e data do último orçamento.
- Cliente com pelo menos um orçamento não pode ser excluído de verdade — é desativado, mantendo o histórico navegável; só quem nunca gerou orçamento pode ser removido por completo.

### Orçamentos

- Dois tipos, escolhidos explicitamente (não inferidos do idioma do documento): **Nacional** — sempre BRL, sempre em português, sem documentação de exportação — e **Internacional** — USD ou EUR, com o documento em português, inglês ou espanhol.
- Tabela de preço **Final** ou **Distribuidor**; distribuidor só existe em USD — BRL e EUR sempre usam o preço final.
- Itens buscados do catálogo por nome/SKU/descrição, com título, descrição e preço editáveis por item. Um preço digitado à mão fica registrado ao lado do preço de tabela, e o documento passa a mostrar as duas colunas quando divergem — é o "preço especial" negociado com o cliente.
- Frete e desconto opcionais; desconto maior que o total do orçamento é rejeitado, para não sair um total negativo por um dígito a mais digitado por engano.
- Numeração automática no formato `AAMMDD-NN` (ex.: `260915-01`, primeiro orçamento daquele dia), sem colisão mesmo com duas pessoas gerando ao mesmo tempo.
- Cada orçamento gera automaticamente um **PDF** e uma planilha **Excel**, com foto do produto, texto de observações padrão por idioma/moeda/tipo (ou personalizado) e a assinatura de quem criou (nome, cargo, telefone, WhatsApp, e-mail e imagem da assinatura, configurados em Minha Conta).
- O tratamento Sr./Sra./Mr./Ms. no documento segue a nacionalidade do **cliente vinculado**, não o idioma do orçamento — um cliente brasileiro tratado num orçamento em inglês continua "Sr."/"Sra.", e vice-versa.
- Vínculo opcional com um cliente cadastrado; o nome impresso no documento é um retrato daquele momento — renomear o cliente depois não muda orçamentos já emitidos.
- Editar um orçamento que já tem **pedido concluído** vinculado exige confirmação explícita, porque os valores desse pedido mudam junto.
- Excluir um orçamento é restrito a administradores, e só é permitido se nenhum pedido foi gerado a partir dele.

### Pedidos

- Gerados a partir de um orçamento existente — herdam itens, preços e moeda dele.
- Câmbio (USD/BRL ou EUR/BRL) buscado automaticamente numa API externa no momento da criação; pode ser sobrescrito à mão quando a busca falhar ou houver uma cotação combinada com o cliente. Pedido nacional não usa câmbio.
- Forma de pagamento antecipado: **Transferência bancária** (qualquer venda), **Pix** (só nacional) e **PayPal** com taxa própria (só internacional) — a API recusa a combinação errada mesmo que alguém tente forçar por fora da tela.
- Peso líquido/bruto do pedido, mais peso por unidade de cada item (usado no Documento de Exportação; um peso digitado no pedido vence o peso de catálogo, que costuma estar em branco).
- Divisão dos itens por caixa/pacote — controla quantas páginas o Packing List Box gera, uma por caixa.
- Cada pedido gera um conjunto de documentos, que se regeneram sozinhos a cada edição:
  - **Invoice** e **Packing List** (só internacional);
  - **Packing List Box** (sempre — em português com código NCM por item para pedido nacional; em inglês, estilo exportação, para internacional);
  - **Documento de Exportação** em Excel (só internacional).
- Upload manual de documentos complementares: AWB, comprovante/boleto (só nacional) e Nota Fiscal.
- "Baixar tudo" empacota todos os documentos do pedido num único `.zip` — baixar vários arquivos separados esbarra no navegador bloqueando downloads automáticos em sequência.
- Aviso de **documentos desatualizados** quando o orçamento de origem foi editado depois da última geração dos documentos do pedido.
- Status **Pendente**/**Concluído**, alternável sem regenerar nenhum documento — é só um marcador (ver também o efeito dele nas Métricas).
- Excluir um pedido é restrito a administradores e apaga também os arquivos gerados/enviados.

### Métricas (administradores)

Painel de análise comercial, calculado sobre todos os pedidos e orçamentos:

- Total vendido, separado por moeda, mais o equivalente inteiro convertido pra BRL usando o câmbio gravado em cada pedido;
- Pedidos por mês e por ano, pendentes vs. concluídos;
- Produtos mais vendidos, por quantidade;
- Setores mais vendidos — contado por orçamento, não por item (um orçamento com 5 produtos do mesmo setor conta uma vez);
- **Funil orçamento → pedido**: taxa de conversão e tempo médio/mediano entre orçamento e fechamento, quebrado por vendedor, por setor e por cliente (ranking dos principais clientes por valor efetivamente fechado).

### Minha Pro Delphus (quadro pessoal)

- Quadro estilo Kanban por usuário, com colunas e tarefas arrastáveis. Três colunas padrão (**Pendente**, **Em andamento**, **Concluído**) são criadas automaticamente no primeiro acesso.
- Tarefas com título, notas, cliente associado (texto livre), tags e prazo; podem linkar direto a um orçamento ou pedido específico.
- Colunas próprias podem ser criadas, renomeadas (duplo clique) e reordenadas; qualquer uma pode ser marcada como "coluna de concluído" — sempre precisa sobrar pelo menos uma.

### NEO — assistente de IA

- Chat interno (Google Gemini) que responde em português sobre o catálogo: produtos por setor — inclusive setores correlatos, decidido pelo próprio modelo —, preços em qualquer moeda, comparação de mais caro/mais barato/dentro de um teto, situação de clientes ("em atendimento" ou não).
- Cria e edita **orçamentos**, **pedidos** e **clientes** — mas nunca grava nada sozinho: toda ação de escrita vira um cartão de prévia (com os valores já calculados) que só é efetivado com um clique explícito de confirmação.
- Regra central, imposta pela API (não só pedida no texto do modelo): moeda, idioma, tipo de preço, peso por item, divisão por caixa e todo campo que muda o total de um documento têm que vir da pessoa — o NEO nunca assume um valor sozinho, sempre pergunta.
- A conversa persiste durante a sessão do navegador: sair da tela e voltar mantém o histórico; fechar o navegador (ou clicar em "Nova conversa") começa do zero.

### Contas e permissões

- Dois papéis: **Administrador** (acesso total — catálogo, setores, contas e métricas incluídos) e **Usuário**/vendedor (clientes, orçamentos, pedidos, tabela de preços e o quadro pessoal, sem catálogo de produtos nem administração).
- Cadastro é auto-serviço (`/cadastro`), mas toda conta nova nasce **pendente** — só entra depois que um admin aprova em Administração → Contas. Rejeitar bloqueia o acesso sem apagar o cadastro.
- Sem recuperação de senha por e-mail: um admin redefine a senha de qualquer conta manualmente.
- O sistema nunca fica sem nenhum admin ativo — remover o cargo, desativar ou excluir o último administrador é bloqueado pela própria API.
- Conta de administrador não pode ser excluída (só desativada); excluir uma conta de vendedor transfere para o admin mais antigo tudo que ela criou (produtos atualizados, clientes, orçamentos, pedidos), preservando o histórico.

### Configurações da conta

- Dados pessoais (nome, cargo, telefone fixo, WhatsApp) — usados na assinatura automática dos orçamentos.
- Idioma padrão do catálogo (inglês ou português) — decide o idioma de exibição do catálogo e qual descrição entra por padrão num orçamento novo.
- Assinatura em imagem, anexada automaticamente no rodapé de todo orçamento gerado por aquele usuário.
- Troca de senha (exige a senha atual).

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
