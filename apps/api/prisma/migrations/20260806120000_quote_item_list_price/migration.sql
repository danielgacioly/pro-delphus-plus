-- Preço de catálogo congelado por item de orçamento.
--
-- Aditiva e anulável de propósito: os itens já emitidos não têm como recuperar
-- qual era o preço de tabela na época, então ficam com NULL e continuam sendo
-- impressos exatamente como hoje, sem a coluna de preço especial.

ALTER TABLE "quote_items" ADD COLUMN "listPrice" DECIMAL(12,2);
