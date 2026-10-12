-- CreateTable
CREATE TABLE "solution_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "mode" TEXT NOT NULL,
    "task_numbers" JSONB,
    "image_key" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "solution_ids" JSONB,
    "failed_task_numbers" JSONB,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "solution_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solution_jobs_status_created_at_idx" ON "solution_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "solution_jobs_user_id_created_at_idx" ON "solution_jobs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "solution_jobs" ADD CONSTRAINT "solution_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
