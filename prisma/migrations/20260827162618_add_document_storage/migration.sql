-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "filePath" TEXT,
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "processingMethod" TEXT;

-- AlterTable
ALTER TABLE "OCRResult" ADD COLUMN     "processingMethod" TEXT,
ALTER COLUMN "confidence" DROP NOT NULL;
