"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-context";
import { useToast } from "@/components/toast-context";
import { HomeState } from "@/components/states/home-state";
import { ConfirmState } from "@/components/states/confirm-state";
import { LoadingState } from "@/components/states/loading-state";
import { optimizeImage, type OptimizedImage } from "@/lib/client/image";
import { apiFetch, isApiError } from "@/lib/client/api";
import type { SolutionSummary, SolutionDetail, ExplanationMode } from "@/types";

type Phase = "home" | "confirm" | "solving";

interface SolvingResponse {
  solution: SolutionDetail;
  balance: number;
}

export function MainSolver() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>("home");
  const [photo, setPhoto] = useState<OptimizedImage | null>(null);
  const [mode, setMode] = useState<ExplanationMode>("step-by-step");
  const [solving, setSolving] = useState(false);
  const [recent, setRecent] = useState<SolutionSummary[] | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Load recent solutions once authenticated.
  useEffect(() => {
    if (!user) return;
    apiFetch<{ solutions: SolutionSummary[] }>("/api/solutions")
      .then((res) => setRecent(res.solutions))
      .catch(() => setRecent([]));
  }, [user]);

  const handleFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      try {
        const optimized = await optimizeImage(file);
        setPhoto(optimized);
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
    setPhase("home");
  }, []);

  const removePhoto = useCallback(() => {
    backToHome();
  }, [backToHome]);

  const solve = useCallback(async () => {
    if (!photo || solving) return;
    setSolving(true);
    setPhase("solving");

    try {
      const res = await apiFetch<SolvingResponse>("/api/solutions", {
        method: "POST",
        json: { image: photo.dataUrl, mode },
      });

      // Refresh the local balance.
      if (user) {
        setUser({ ...user, balance: res.balance });
      }

      // Go to the result screen.
      router.replace(`/result/${res.solution.id}`);
    } catch (err) {
      if (isApiError(err) && err.code === "INSUFFICIENT_CREDITS") {
        toast.error("У вас закончились решения");
        router.replace("/balance");
      } else if (isApiError(err)) {
        toast.error(err.message);
        setPhase("confirm");
      } else {
        toast.error("Не удалось решить задачу. Попробуйте ещё раз.");
        setPhase("confirm");
      }
      setSolving(false);
    }
  }, [photo, solving, mode, user, setUser, toast, router]);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md pb-24">
      {phase === "home" && (
        <HomeState recent={recent} onPickCamera={pickCamera} onPickGallery={pickGallery} />
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
