"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-context";
import { useToast } from "@/components/toast-context";
import { HomeState } from "@/components/states/home-state";
import { ConfirmState } from "@/components/states/confirm-state";
import { LoadingState } from "@/components/states/loading-state";
import { DetectingState } from "@/components/states/detecting-state";
import { TaskPickState } from "@/components/states/task-pick-state";
import { optimizeImage, type OptimizedImage } from "@/lib/client/image";
import { apiFetch, isApiError } from "@/lib/client/api";
import type { ExplanationMode, SolutionJobDto } from "@/types";

type Phase = "home" | "confirm" | "detecting" | "pick" | "solving";

const POLL_INTERVAL_MS = 3000;

export function MainSolver() {
  const router = useRouter();
  const { user, getBalance } = useAuth();
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>("home");
  const [photo, setPhoto] = useState<OptimizedImage | null>(null);
  const [mode, setMode] = useState<ExplanationMode>("step-by-step");
  const [solving, setSolving] = useState(false);
  const [detectedNumbers, setDetectedNumbers] = useState<string[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  /** Task labels for the running job (used to build the result-screen query). */
  const [jobTaskNumbers, setJobTaskNumbers] = useState<string[] | null>(null);
  /** Live queue snapshot for the running job (position/size), shown on the loading screen. */
  const [queueInfo, setQueueInfo] = useState<{ position: number | null; size: number } | null>(
    null,
  );

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const pickCamera = useCallback(() => {
    cameraRef.current?.click();
  }, []);

  const pickGallery = useCallback(() => {
    galleryRef.current?.click();
  }, []);

  const handleFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      try {
        const optimized = await optimizeImage(file);
        setPhoto(optimized);
        setMode("step-by-step");
        setDetectedNumbers([]);
        setPhase("confirm");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Не удалось обработать фото.");
      } finally {
        // reset inputs so re-picking the same file still fires onChange
        if (cameraRef.current) cameraRef.current.value = "";
        if (galleryRef.current) galleryRef.current.value = "";
      }
    },
    [toast],
  );

  const backToHome = useCallback(() => {
    setPhoto(null);
    setMode("step-by-step");
    setDetectedNumbers([]);
    setPhase("home");
    setJobId(null);
    setJobTaskNumbers(null);
    setQueueInfo(null);
    setSolving(false);
  }, []);

  const removePhoto = useCallback(() => {
    backToHome();
  }, [backToHome]);

  const returnToConfirm = useCallback(() => {
    setDetectedNumbers([]);
    setSolving(false);
    setPhase("confirm");
  }, []);

  /** Handle a finished job (done or error). */
  const handleJobResult = useCallback(
    async (job: SolutionJobDto, taskNumbers: string[] | null) => {
      if (job.status === "done") {
        await getBalance(); // reflects the write-off; also refreshes local user

        // Some tasks failed to solve — let the user know which ones are missing.
        if (job.failedTaskNumbers.length > 0) {
          toast.error(
            `Не удалось решить задачи ${job.failedTaskNumbers.join(", ")} — за них ничего не списано`,
          );
        }

        const first = job.solutionIds[0];
        if (first) {
          if (job.solutionIds.length > 1) {
            toast.success(`Решено задач: ${job.solutionIds.length}`);
            const ids = job.solutionIds.join(",");
            // Solutions come back in request order with failures skipped, so the
            // selected numbers minus the failed ones line up 1:1 with solutions.
            const solvedNumbers = (taskNumbers ?? []).filter(
              (n) => !job.failedTaskNumbers.includes(n),
            );
            const nums =
              solvedNumbers.length === job.solutionIds.length
                ? `&nums=${solvedNumbers.join(",")}`
                : "";
            router.replace(`/result/${first}?ids=${ids}${nums}`);
          } else {
            router.replace(`/result/${first}`);
          }
        } else {
          // Everything failed — stay on the pick screen so the user can retry.
          setPhase("confirm");
        }
      } else {
        // status === "error"
        const code = job.errorCode ?? "";
        const message = job.errorMessage ?? "Не удалось решить задачу. Попробуйте ещё раз.";
        if (code === "INSUFFICIENT_CREDITS") {
          toast.error("У вас закончились решения");
          router.replace("/balance");
        } else if (code === "NOT_A_TASK") {
          // The photo holds no school task — drop it so the user takes a new one.
          toast.error(message);
          backToHome();
        } else {
          toast.error(message);
          setPhase("confirm");
        }
        setSolving(false);
      }
    },
    [getBalance, toast, router, backToHome],
  );

  /** Enqueue the actual paid solve call and poll until we get a result. */
  const runSolve = useCallback(
    async (taskNumbers: string[] | null) => {
      if (!photo || solving) return;
      setSolving(true);
      setQueueInfo(null);
      setPhase("solving");

      try {
        const res = await apiFetch<{ ok: boolean; jobId: string; status: string }>(
          "/api/solutions",
          {
            method: "POST",
            json: { image: photo.dataUrl, mode, taskNumbers },
          },
        );
        setJobTaskNumbers(taskNumbers);
        setJobId(res.jobId);
      } catch (err) {
        // Enqueue failed — map to the same UX as before.
        if (isApiError(err) && err.code === "INSUFFICIENT_CREDITS") {
          toast.error("У вас закончились решения");
          router.replace("/balance");
        } else if (isApiError(err) && err.code === "NOT_A_TASK") {
          // The photo holds no school task — drop it so the user takes a new one.
          toast.error(err.message);
          backToHome();
        } else if (isApiError(err)) {
          toast.error(err.message);
          setPhase("confirm");
        } else {
          toast.error("Не удалось решить задачу. Попробуйте ещё раз.");
          setPhase("confirm");
        }
        setSolving(false);
      }
    },
    [photo, mode, solving, toast, router, backToHome],
  );

  /** Poll the job status until done/error, then hand off to handleJobResult. */
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await apiFetch<{ ok: boolean; job: SolutionJobDto }>(
          `/api/solutions/status?jobId=${encodeURIComponent(jobId)}`,
        );
        const job = res.job;
        if (job.status === "processing" || job.status === "queued") {
          // still waiting/running — surface the live queue position
          setQueueInfo({ position: job.queuePosition ?? null, size: job.queueSize ?? 0 });
          return; // keep polling
        }
        setJobId(null); // stop polling for this job
        setQueueInfo(null);
        await handleJobResult(job, jobTaskNumbers);
      } catch {
        // transient network error → keep polling
      }
    };

    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [jobId, jobTaskNumbers, handleJobResult]);

  /** Solve — first detect task numbers, then ask or solve directly. */
  const solve = useCallback(async () => {
    if (!photo || solving) return;
    setSolving(true);
    setPhase("detecting");

    try {
      const res = await apiFetch<{ ok: boolean; numbers: string[] }>("/api/solutions/detect", {
        method: "POST",
        json: { image: photo.dataUrl },
      });
      const numbers = (res?.numbers ?? []).map((n) => String(n).trim()).filter(Boolean);

      if (numbers.length >= 2) {
        // Several tasks on the photo → ask the user which one to solve.
        setDetectedNumbers(numbers);
        setPhase("pick");
        setSolving(false);
        return;
      }

      // 0 or 1 number → no need to ask; use it (or solve whole photo).
      await runSolve(numbers[0] ? [numbers[0]] : null);
    } catch {
      // Detection is best-effort; on any network error, fall back to solving the whole photo.
      toast.info("Не удалось распознать номера задач — решим всё фото.");
      await runSolve(null);
    }
  }, [photo, solving, runSolve, toast]);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md pb-nav">
      {phase === "home" && <HomeState onPickCamera={pickCamera} onPickGallery={pickGallery} />}
      {phase === "confirm" && photo && (
        <ConfirmState
          photo={photo}
          mode={mode}
          onModeChange={setMode}
          onSolve={solve}
          onRetake={pickCamera}
          onRemove={removePhoto}
          solving={solving}
          balance={user?.balance ?? null}
        />
      )}
      {phase === "detecting" && <DetectingState />}
      {phase === "pick" && (
        <TaskPickState
          numbers={detectedNumbers}
          mode={mode}
          onModeChange={setMode}
          onBack={returnToConfirm}
          onSolve={(nums) => runSolve(nums)}
        />
      )}
      {phase === "solving" && <LoadingState queue={queueInfo} />}

      {/* Hidden inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
