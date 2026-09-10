-- CreateTable
CREATE TABLE "OCRWord" (
    "id" SERIAL NOT NULL,
    "ocrResultId" INTEGER NOT NULL,
    "originalWord" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "suggestedWord" TEXT,
    "reviewDecision" TEXT NOT NULL DEFAULT 'PENDING',
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OCRWord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OCRWord" ADD CONSTRAINT "OCRWord_ocrResultId_fkey" FOREIGN KEY ("ocrResultId") REFERENCES "OCRResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
