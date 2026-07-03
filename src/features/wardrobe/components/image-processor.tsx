"use client";

/* eslint-disable @next/next/no-img-element -- previews render local blob URLs */

import { useEffect, useMemo, useRef, useState } from "react";
import { Crop, ImageOff, Loader2, RotateCcw, Sparkles } from "lucide-react";
import {
  EmptyCutoutError,
  cropAndNormalize,
  processClothingImage,
  type CropRect,
  type ProcessProgress,
} from "@/lib/bg-removal";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Phase =
  | { kind: "processing"; progress: ProcessProgress | null }
  | { kind: "preview"; blob: Blob }
  | { kind: "crop" }
  | { kind: "error"; message: string };

/** One background-removal run: a file plus its retry counter. */
interface Job {
  file: File | null;
  attempt: number;
}

/** Subtle checkerboard so PNG transparency reads as "clean cutout". */
const CHECKER: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, rgb(0 0 0 / 0.05) 25%, transparent 25%, transparent 75%, rgb(0 0 0 / 0.05) 75%), linear-gradient(45deg, rgb(0 0 0 / 0.05) 25%, transparent 25%, transparent 75%, rgb(0 0 0 / 0.05) 75%)",
  backgroundSize: "18px 18px",
  backgroundPosition: "0 0, 9px 9px",
};

/**
 * Runs each freshly picked photo through background removal, previews the
 * isolated item, and offers retry / manual crop / original as fallbacks.
 */
export function ImageProcessorDialog({
  file,
  remaining,
  onAccept,
  onCancel,
}: {
  file: File | null;
  /** How many more photos are queued after this one. */
  remaining: number;
  onAccept: (blob: Blob) => Promise<void>;
  onCancel: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);

  const job = useMemo<Job>(() => ({ file, attempt }), [file, attempt]);
  // phase is keyed to its job; a stale result for an old job reads as
  // "processing" for the current one, so no synchronous resets are needed
  const [result, setResult] = useState<{ job: Job; phase: Phase } | null>(
    null,
  );
  const phase: Phase =
    result?.job === job ? result.phase : { kind: "processing", progress: null };

  const originalUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(
    () => () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
    },
    [originalUrl],
  );

  const previewBlob = phase.kind === "preview" ? phase.blob : null;
  const previewUrl = useMemo(
    () => (previewBlob ? URL.createObjectURL(previewBlob) : null),
    [previewBlob],
  );
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  useEffect(() => {
    if (!job.file) return;
    let stale = false;
    processClothingImage(job.file, (progress) => {
      if (!stale) setResult({ job, phase: { kind: "processing", progress } });
    })
      .then((blob) => {
        if (!stale) setResult({ job, phase: { kind: "preview", blob } });
      })
      .catch((err: unknown) => {
        if (stale) return;
        setResult({
          job,
          phase: {
            kind: "error",
            message:
              err instanceof EmptyCutoutError
                ? "We couldn't isolate a clothing item in this photo."
                : "Background removal failed.",
          },
        });
      });
    return () => {
      stale = true;
    };
  }, [job]);

  const accept = async (blob: Blob) => {
    setBusy(true);
    try {
      await onAccept(blob);
    } finally {
      setBusy(false);
    }
  };

  const applyCrop = async (rect: CropRect) => {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await cropAndNormalize(file, rect);
      setResult({ job, phase: { kind: "preview", blob } });
    } finally {
      setBusy(false);
    }
  };

  const fallbackButtons = (
    <div className="grid grid-cols-3 gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => setAttempt((a) => a + 1)}
      >
        <RotateCcw className="size-3.5" /> Retry
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => setResult({ job, phase: { kind: "crop" } })}
      >
        <Crop className="size-3.5" /> Crop
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={busy || !file}
        onClick={() => file && accept(file)}
      >
        Use original
      </Button>
    </div>
  );

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent className="sm:max-w-md" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet-500" />
            Preparing item
            {remaining > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                +{remaining} more
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {phase.kind === "processing" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="relative">
              {originalUrl && (
                <img
                  src={originalUrl}
                  alt=""
                  className="size-28 rounded-2xl object-cover opacity-60 blur-[1px]"
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="size-6 animate-spin text-foreground/70" />
              </div>
            </div>
            <div className="w-full max-w-56 space-y-2 text-center">
              <p className="text-sm font-medium">
                {phase.progress?.stage === "model"
                  ? "Preparing the magic (first run only)…"
                  : "Isolating your item…"}
              </p>
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full bg-foreground/70 transition-[width] duration-300",
                    phase.progress?.value == null && "w-1/3 animate-pulse",
                  )}
                  style={
                    phase.progress?.value != null
                      ? { width: `${Math.round(phase.progress.value * 100)}%` }
                      : undefined
                  }
                />
              </div>
            </div>
          </div>
        )}

        {phase.kind === "preview" && previewUrl && (
          <div className="space-y-4">
            <div
              className="relative overflow-hidden rounded-2xl border"
              style={CHECKER}
            >
              <img
                src={previewUrl}
                alt="Isolated item"
                className="mx-auto aspect-square w-full max-w-72 object-contain"
              />
              {originalUrl && (
                <img
                  src={originalUrl}
                  alt="Original photo"
                  className="absolute bottom-2 left-2 size-14 rounded-lg border bg-background object-cover shadow-md"
                />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button disabled={busy} onClick={() => accept(phase.blob)}>
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Uploading…
                  </>
                ) : (
                  "Use this item"
                )}
              </Button>
              {fallbackButtons}
            </div>
          </div>
        )}

        {phase.kind === "crop" && originalUrl && (
          <CropStage
            src={originalUrl}
            busy={busy}
            onApply={applyCrop}
            onBack={() => setAttempt((a) => a + 1)}
          />
        )}

        {phase.kind === "error" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <ImageOff className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">{phase.message}</p>
              <p className="text-xs text-muted-foreground">
                Try again, crop it by hand, or keep the original photo.
              </p>
            </div>
            {fallbackButtons}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type DragMode = "move" | "nw" | "ne" | "sw" | "se";
interface Frac {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_SIZE = 0.08;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

function CropStage({
  src,
  busy,
  onApply,
  onBack,
}: {
  src: string;
  busy: boolean;
  onApply: (rect: CropRect) => void;
  onBack: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    rect: Frac;
  } | null>(null);
  const [rect, setRect] = useState<Frac>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });

  const beginDrag = (e: React.PointerEvent, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, rect };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const frame = frameRef.current;
    if (!drag || !frame) return;
    const bounds = frame.getBoundingClientRect();
    const dx = (e.clientX - drag.startX) / bounds.width;
    const dy = (e.clientY - drag.startY) / bounds.height;
    const r = drag.rect;

    setRect(() => {
      switch (drag.mode) {
        case "move":
          return {
            ...r,
            x: clamp(r.x + dx, 0, 1 - r.w),
            y: clamp(r.y + dy, 0, 1 - r.h),
          };
        case "se":
          return {
            ...r,
            w: clamp(r.w + dx, MIN_SIZE, 1 - r.x),
            h: clamp(r.h + dy, MIN_SIZE, 1 - r.y),
          };
        case "sw": {
          const x = clamp(r.x + dx, 0, r.x + r.w - MIN_SIZE);
          return {
            ...r,
            x,
            w: r.w + (r.x - x),
            h: clamp(r.h + dy, MIN_SIZE, 1 - r.y),
          };
        }
        case "ne": {
          const y = clamp(r.y + dy, 0, r.y + r.h - MIN_SIZE);
          return {
            ...r,
            y,
            h: r.h + (r.y - y),
            w: clamp(r.w + dx, MIN_SIZE, 1 - r.x),
          };
        }
        case "nw": {
          const x = clamp(r.x + dx, 0, r.x + r.w - MIN_SIZE);
          const y = clamp(r.y + dy, 0, r.y + r.h - MIN_SIZE);
          return { x, y, w: r.w + (r.x - x), h: r.h + (r.y - y) };
        }
      }
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const handles: { mode: DragMode; className: string }[] = [
    { mode: "nw", className: "-left-1.5 -top-1.5 cursor-nwse-resize" },
    { mode: "ne", className: "-right-1.5 -top-1.5 cursor-nesw-resize" },
    { mode: "sw", className: "-left-1.5 -bottom-1.5 cursor-nesw-resize" },
    { mode: "se", className: "-right-1.5 -bottom-1.5 cursor-nwse-resize" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Drag to frame just the clothing item.
      </p>
      <div
        ref={frameRef}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative mx-auto w-fit touch-none select-none overflow-hidden rounded-2xl border bg-muted"
      >
        <img src={src} alt="Original photo" className="max-h-[45vh] w-auto" />
        <div
          onPointerDown={(e) => beginDrag(e, "move")}
          className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgb(0_0_0/0.55)]"
          style={{
            left: `${rect.x * 100}%`,
            top: `${rect.y * 100}%`,
            width: `${rect.w * 100}%`,
            height: `${rect.h * 100}%`,
          }}
        >
          {handles.map(({ mode, className }) => (
            <span
              key={mode}
              onPointerDown={(e) => beginDrag(e, mode)}
              className={cn(
                "absolute size-4 rounded-full border-2 border-white bg-foreground shadow",
                className,
              )}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={busy} onClick={onBack}>
          Back
        </Button>
        <Button
          disabled={busy}
          onClick={() =>
            onApply({ x: rect.x, y: rect.y, width: rect.w, height: rect.h })
          }
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Apply crop"}
        </Button>
      </div>
    </div>
  );
}
