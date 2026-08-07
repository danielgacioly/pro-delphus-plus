-- Recuperação de senha por e-mail foi removida: quem redefine senha é o admin,
-- pelo painel de contas. Sem o fluxo, as colunas de token só guardariam lixo.

ALTER TABLE "users" DROP COLUMN IF EXISTS "resetPasswordTokenHash";
ALTER TABLE "users" DROP COLUMN IF EXISTS "resetPasswordExpiresAt";
