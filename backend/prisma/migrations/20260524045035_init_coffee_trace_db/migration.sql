-- CreateTable
CREATE TABLE "Agent" (
    "walletAddress" VARCHAR(42) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "role" VARCHAR(30) NOT NULL,
    "phone" VARCHAR(20),
    "email" VARCHAR(100),
    "physicalAddress" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("walletAddress")
);

-- CreateTable
CREATE TABLE "CoffeeLot" (
    "lotId" BIGINT NOT NULL,
    "qrCode" VARCHAR(100),
    "currentStatus" VARCHAR(20) NOT NULL,
    "currentActor" VARCHAR(42) NOT NULL,
    "farmerAddress" VARCHAR(42) NOT NULL,
    "initTxHash" VARCHAR(66) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoffeeLot_pkey" PRIMARY KEY ("lotId")
);

-- CreateTable
CREATE TABLE "LotStageDetail" (
    "id" SERIAL NOT NULL,
    "lotId" BIGINT NOT NULL,
    "stageName" VARCHAR(20) NOT NULL,
    "actorAddress" VARCHAR(42) NOT NULL,
    "stageDataPayload" JSONB NOT NULL,
    "ipfsHash" VARCHAR(100),
    "txHash" VARCHAR(66) NOT NULL,
    "blockchainTimestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LotStageDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotTimeline" (
    "id" SERIAL NOT NULL,
    "lotId" BIGINT NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "actorAddress" VARCHAR(42) NOT NULL,
    "description" TEXT NOT NULL,
    "txHash" VARCHAR(66) NOT NULL,
    "blockchainTimestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LotTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoffeeLot_qrCode_key" ON "CoffeeLot"("qrCode");

-- CreateIndex
CREATE INDEX "CoffeeLot_currentStatus_idx" ON "CoffeeLot"("currentStatus");

-- CreateIndex
CREATE INDEX "CoffeeLot_currentActor_idx" ON "CoffeeLot"("currentActor");

-- CreateIndex
CREATE INDEX "LotStageDetail_lotId_idx" ON "LotStageDetail"("lotId");

-- CreateIndex
CREATE INDEX "LotTimeline_lotId_idx" ON "LotTimeline"("lotId");

-- AddForeignKey
ALTER TABLE "CoffeeLot" ADD CONSTRAINT "CoffeeLot_currentActor_fkey" FOREIGN KEY ("currentActor") REFERENCES "Agent"("walletAddress") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoffeeLot" ADD CONSTRAINT "CoffeeLot_farmerAddress_fkey" FOREIGN KEY ("farmerAddress") REFERENCES "Agent"("walletAddress") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotStageDetail" ADD CONSTRAINT "LotStageDetail_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "CoffeeLot"("lotId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotStageDetail" ADD CONSTRAINT "LotStageDetail_actorAddress_fkey" FOREIGN KEY ("actorAddress") REFERENCES "Agent"("walletAddress") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotTimeline" ADD CONSTRAINT "LotTimeline_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "CoffeeLot"("lotId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotTimeline" ADD CONSTRAINT "LotTimeline_actorAddress_fkey" FOREIGN KEY ("actorAddress") REFERENCES "Agent"("walletAddress") ON DELETE RESTRICT ON UPDATE CASCADE;
