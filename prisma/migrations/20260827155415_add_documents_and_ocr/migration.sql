-- CreateTable
CREATE TABLE "Document" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "documentType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OCRResult" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "originalText" TEXT NOT NULL,
    "correctedText" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REVIEW',
    "correctedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OCRResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OCRResult_documentId_key" ON "OCRResult"("documentId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OCRResult" ADD CONSTRAINT "OCRResult_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
