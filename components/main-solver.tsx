"use client";

import { useCallback, useRef, useState } from "react";
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
import type { SolutionDetail, ExplanationMode } from "@/types";

type Phase = "home" | "confirm" | "detecting" | "pick" | "solving";

interface SolvingResponse {
  solutions: SolutionDetail[];
  balance: number;
  failedTaskNumbers: string[];
}

export function MainSolver() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>("home");
  const [photo, setPhoto] = useState<OptimizedImage | null>(null);
  const [mode, setMode] = useState<ExplanationMode>("step-by-step");
  const [solving, setSolving] = useState(false);
  const [detectedNumbers, setDetectedNumbers] = useState<string[]>([]);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

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

  const pickCamera = useCallback(() => {
    cameraRef.current?.click();
  }, []);

  const pickGallery = useCallback(() => {
    galleryRef.current?.click();
  }, []);

  const backToHome = useCallback(() => {
    setPhoto(null);
    setMode("step-by-step");
    setDetectedNumbers([]);
    setPhase("home");
  }, []);

  const removePhoto = useCallback(() => {
    backToHome();
  }, [backToHome]);

  const returnToConfirm = useCallback(() => {
    setDetectedNumbers([]);
    setSolving(false);
    setPhase("confirm");
  }, []);

  /** The actual paid solve call. `taskNumbers` may be null/empty → solve the whole photo. */
  const runSolve = useCallback(
    async (taskNumbers: string[] | null) => {
      if (!photo) return;
      setSolving(true);
      setPhase("solving");

      try {
        const res = await apiFetch<SolvingResponse>("/api/solutions", {
          method: "POST",
          json: { image: photo.dataUrl, mode, taskNumbers },
        });

        // Refresh the local balance.
        if (user) {
          setUser({ ...user, balance: res.balance });
        }

        // Some tasks failed to solve — let the user know which ones are missing.
        if (res.failedTaskNumbers.length > 0) {
          toast.error(
            `Не удалось решить задачи ${res.failedTaskNumbers.join(", ")} — за них ничего не списано`,
          );
        }

        // Go to the result screen. When several tasks were solved, pass all
        // solution ids (and their task numbers) so the user can switch between them.
        const first = res.solutions[0];
        if (first) {
          if (res.solutions.length > 1) {
            toast.success(`Решено задач: ${res.solutions.length}`);
            const ids = res.solutions.map((s) => s.id).join(",");
            // Solutions come back in request order with failures skipped, so the
            // selected numbers minus the failed ones line up 1:1 with solutions.
            const solvedNumbers = (taskNumbers ?? []).filter(
              (n) => !res.failedTaskNumbers.includes(n),
            );
            const nums =
              solvedNumbers.length === res.solutions.length
                ? `&nums=${solvedNumbers.join(",")}`
                : "";
            router.replace(`/result/${first.id}?ids=${ids}${nums}`);
          } else {
            router.replace(`/result/${first.id}`);
          }
        } else {
          // Everything failed — stay on the pick screen so the user can retry.
          setPhase("confirm");
        }
      } catch (err) {
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
    [photo, mode, user, setUser, toast, router, backToHome],
  );

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
      {phase === "home" && (
        <HomeState onPickCamera={pickCamera} onPickGallery={pickGallery} />
      )}
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
      {phase === "solving" && <LoadingState />}

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
