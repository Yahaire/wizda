-- CreateTable
CREATE TABLE "PopularJunkOracleQueryDay" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PopularJunkOracleQueryDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PopularJunkOracleQueryDay_day_idx" ON "PopularJunkOracleQueryDay"("day");

-- CreateIndex
CREATE UNIQUE INDEX "PopularJunkOracleQueryDay_queryId_day_key" ON "PopularJunkOracleQueryDay"("queryId", "day");

-- AddForeignKey
ALTER TABLE "PopularJunkOracleQueryDay" ADD CONSTRAINT "PopularJunkOracleQueryDay_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "PopularJunkOracleQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
