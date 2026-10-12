-- AlterTable
ALTER TABLE "solution_jobs" ADD COLUMN     "run_after_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "solution_jobs_status_run_after_at_idx" ON "solution_jobs"("status", "run_after_at");
