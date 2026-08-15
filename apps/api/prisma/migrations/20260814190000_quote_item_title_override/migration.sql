-- Nome do item impresso no documento. Null = usar o nome do produto no
-- catálogo (comportamento histórico); preenchido = override digitado no
-- orçamento, que precisa sobreviver a renomeações do catálogo.
ALTER TABLE "quote_items" ADD COLUMN "title" TEXT;
