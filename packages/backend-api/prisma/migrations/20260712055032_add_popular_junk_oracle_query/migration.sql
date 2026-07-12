-- CreateTable
CREATE TABLE "PopularJunkOracleQuery" (
    "id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PopularJunkOracleQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PopularJunkOracleQueryTerm" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,

    CONSTRAINT "PopularJunkOracleQueryTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PopularJunkOracleQuery_signature_key" ON "PopularJunkOracleQuery"("signature");

-- CreateIndex
CREATE INDEX "PopularJunkOracleQueryTerm_kind_key_idx" ON "PopularJunkOracleQueryTerm"("kind", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PopularJunkOracleQueryTerm_queryId_kind_key_key" ON "PopularJunkOracleQueryTerm"("queryId", "kind", "key");

-- AddForeignKey
ALTER TABLE "PopularJunkOracleQueryTerm" ADD CONSTRAINT "PopularJunkOracleQueryTerm_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "PopularJunkOracleQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
