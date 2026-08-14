#!/bin/sh
set -e

# As migrações rodam na subida, antes de o servidor aceitar tráfego.
# `migrate deploy` só aplica o que já está versionado — nunca gera migração nova
# nem apaga dado, então é seguro rodar a cada deploy.
#
# Esta parte precisa de root: o CLI do Prisma verifica se consegue escrever em
# node_modules/@prisma/engines antes de qualquer coisa. Em vez de dar 28 MB de
# node_modules ao usuário sem privilégio, migramos como root e servimos como
# `node` — o processo de vida longa, que é o exposto, nunca roda privilegiado.
echo "→ aplicando migrações"
# O prisma.config.ts (onde mora a DATABASE_URL) só é lido a partir do diretório
# do pacote, então a migração roda de dentro de apps/api.
(cd apps/api && npx prisma migrate deploy)

echo "→ iniciando API como usuário node"
# Para criar o primeiro admin depois da subida:
#   docker compose ... exec api node apps/api/dist/prisma/seed.js
#
# `setpriv` troca uid/gid mas NÃO ajusta $HOME — sem o `env HOME=...` abaixo,
# o processo continua com o HOME herdado do root (/root), que o usuário node
# não tem permissão de escrever. Isso passa despercebido até o Chromium tentar
# guardar o banco do crashpad ali e falhar com "chrome_crashpad_handler:
# --database is required", derrubando a geração de PDF (confirmado em
# produção: falha com HOME=/root, funciona com um HOME gravável).
exec setpriv --reuid=node --regid=node --init-groups \
  env HOME=/home/node \
  node apps/api/dist/src/index.js
