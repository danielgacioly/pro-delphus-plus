CREATE TABLE "personal_board_columns" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_board_columns_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "personal_board_columns" ADD CONSTRAINT "personal_board_columns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "personal_tasks" ADD COLUMN "columnId" TEXT;
ALTER TABLE "personal_tasks" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "personal_tasks" ADD COLUMN "dueDate" TIMESTAMP(3);

-- Backfill: give every user who already has tasks the 3 default columns.
INSERT INTO "personal_board_columns" ("id", "userId", "name", "position")
SELECT gen_random_uuid(), u."userId", col.name, col.position
FROM (SELECT DISTINCT "userId" FROM "personal_tasks") u
CROSS JOIN (VALUES ('Pendente', 0), ('Em andamento', 1), ('Concluído', 2)) AS col(name, position);

-- Map each task's old status to the matching new column.
UPDATE "personal_tasks" t
SET "columnId" = c."id"
FROM "personal_board_columns" c
WHERE c."userId" = t."userId"
  AND (
    (t."status" = 'TODO' AND c."name" = 'Pendente') OR
    (t."status" = 'DOING' AND c."name" = 'Em andamento') OR
    (t."status" = 'DONE' AND c."name" = 'Concluído')
  );

ALTER TABLE "personal_tasks" ALTER COLUMN "columnId" SET NOT NULL;
ALTER TABLE "personal_tasks" ADD CONSTRAINT "personal_tasks_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "personal_board_columns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "personal_tasks" DROP COLUMN "status";
DROP TYPE "TaskStatus";
