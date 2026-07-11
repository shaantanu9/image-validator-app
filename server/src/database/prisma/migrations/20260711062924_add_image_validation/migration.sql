-- CreateEnum
CREATE TYPE "ImageStatus" AS ENUM ('ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "images" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "original_name" TEXT NOT NULL,
    "status" "ImageStatus" NOT NULL,
    "rejection_reason" TEXT,
    "rejection_detail" TEXT,
    "format" TEXT,
    "transcoded" BOOLEAN NOT NULL DEFAULT false,
    "bytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "frame_sharpness" DOUBLE PRECISION,
    "face_sharpness" DOUBLE PRECISION,
    "face_box" JSONB,
    "phash" TEXT,
    "phash_bands" TEXT[],
    "phash_algorithm" TEXT,
    "storage_key" TEXT,
    "storage_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "images_owner_id_status_idx" ON "images"("owner_id", "status");

-- CreateIndex
CREATE INDEX "images_owner_id_created_at_idx" ON "images"("owner_id", "created_at");

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The duplicate prefilter for rule 3. Two pHashes within Hamming distance <= 3
-- MUST share at least one identical 16-bit band (pigeonhole), so the candidate
-- lookup is an indexed array-overlap (`phash_bands && $1`) rather than a scan of
-- every image the owner has ever uploaded. Without this, dedup is O(n) per file.
CREATE INDEX "images_phash_bands_gin" ON "images" USING GIN ("phash_bands");
