-- CreateTable
CREATE TABLE "Patient" (
    "id" SERIAL NOT NULL,
    "studentId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "age" INTEGER,
    "sex" TEXT,
    "grade" TEXT,
    "section" TEXT,
    "contactNumber" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Patient_studentId_key" ON "Patient"("studentId");
