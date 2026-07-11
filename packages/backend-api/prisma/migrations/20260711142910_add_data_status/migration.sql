-- CreateTable
CREATE TABLE "DataStatus" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastSeededAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataStatus_pkey" PRIMARY KEY ("id")
);
