-- CreateTable
CREATE TABLE "ClinicRecord" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "chiefComplaint" TEXT,
    "symptoms" TEXT,
    "temperature" TEXT,
    "bloodPressure" TEXT,
    "diagnosis" TEXT,
    "treatment" TEXT,
    "medication" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ClinicRecord" ADD CONSTRAINT "ClinicRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
