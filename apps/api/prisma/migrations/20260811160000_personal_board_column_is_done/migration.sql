-- Quadros pessoais agora podem ser marcados como "concluído" — evita depender
-- do nome exato da coluna ("Concluído") pra saber se uma tarefa já foi feita,
-- o que quebrava assim que alguém renomeava ou criava um quadro equivalente.
ALTER TABLE "personal_board_columns" ADD COLUMN "isDone" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: quadros já existentes chamados "Concluído" já representam a coluna de feito.
UPDATE "personal_board_columns" SET "isDone" = true WHERE "name" = 'Concluído';
