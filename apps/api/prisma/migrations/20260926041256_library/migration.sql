-- CreateTable
CREATE TABLE "library_entries" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "embeddingModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "library_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ClientToLibraryEntry" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ClientToLibraryEntry_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_LibraryEntryToProduct" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_LibraryEntryToProduct_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ClientToLibraryEntry_B_index" ON "_ClientToLibraryEntry"("B");

-- CreateIndex
CREATE INDEX "_LibraryEntryToProduct_B_index" ON "_LibraryEntryToProduct"("B");

-- AddForeignKey
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClientToLibraryEntry" ADD CONSTRAINT "_ClientToLibraryEntry_A_fkey" FOREIGN KEY ("A") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClientToLibraryEntry" ADD CONSTRAINT "_ClientToLibraryEntry_B_fkey" FOREIGN KEY ("B") REFERENCES "library_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LibraryEntryToProduct" ADD CONSTRAINT "_LibraryEntryToProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "library_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LibraryEntryToProduct" ADD CONSTRAINT "_LibraryEntryToProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
