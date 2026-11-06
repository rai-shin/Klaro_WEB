-- CreateTable
CREATE TABLE "VisitationLog" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "timeIn" TEXT NOT NULL,
    "courseYearBlock" TEXT,
    "complaint" TEXT,
    "signature" TEXT,
    "medicineGiven" TEXT,
    "quantity" TEXT,
    "adviserInformed" TEXT NOT NULL DEFAULT 'No',
    "guardianInformed" TEXT NOT NULL DEFAULT 'No',
    "finalEvaluation" TEXT,
    "timeOut" TEXT,
    "nod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisitationLog_patientId_idx" ON "VisitationLog"("patientId");

-- CreateIndex
CREATE INDEX "VisitationLog_visitDate_idx" ON "VisitationLog"("visitDate");

-- AddForeignKey
ALTER TABLE "VisitationLog" ADD CONSTRAINT "VisitationLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
