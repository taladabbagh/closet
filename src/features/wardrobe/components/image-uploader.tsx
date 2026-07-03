"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { imageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";
import { ImageProcessorDialog } from "./image-processor";

export interface PendingImage {
  path: string;
  position: number;
}

const MAX_IMAGES = 12;
const MAX_SIZE_MB = 10;

/**
 * Picks photos, runs them through background removal (via
 * ImageProcessorDialog), then uploads the clean cutout to the
 * "wardrobe" bucket under <uid>/<uuid>.<ext>.
 */
export function ImageUploader({
  userId,
  images,
  onChange,
}: {
  userId: string;
  images: PendingImage[];
  onChange: (next: PendingImage[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // photos waiting to be processed; the first one is in the dialog
  const [queue, setQueue] = useState<File[]>([]);

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_IMAGES - images.length - queue.length;
    if (room <= 0) {
      toast.error(`Maximum ${MAX_IMAGES} images per item`);
      return;
    }
    const selected: File[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name} is larger than ${MAX_SIZE_MB} MB`);
        continue;
      }
      selected.push(file);
    }
    if (selected.length) setQueue((q) => [...q, ...selected]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const advance = () => setQueue((q) => q.slice(1));

  const upload = async (blob: Blob) => {
    const ext = blob.type === "image/png" ? "png" : "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const supabase = createClient();
    const { error } = await supabase.storage
      .from("wardrobe")
      .upload(path, blob, { contentType: blob.type || "image/png" });
    if (error) {
      toast.error(`Upload failed: ${error.message}`);
    } else {
      onChange(
        [...images, { path, position: 0 }].map((img, i) => ({
          ...img,
          position: i,
        })),
      );
    }
    advance();
  };

  const remove = async (path: string) => {
    onChange(
      images
        .filter((i) => i.path !== path)
        .map((img, i) => ({ ...img, position: i })),
    );
    // Newly uploaded (unsaved) objects are cleaned up right away; objects
    // referenced by a saved item are removed by the update action instead.
    const supabase = createClient();
    await supabase.storage.from("wardrobe").remove([path]).catch(() => {});
  };

  return (
    <div className="flex flex-wrap gap-2">
      {images.map((img, i) => (
        <div
          key={img.path}
          className="group relative size-20 overflow-hidden rounded-xl border bg-muted"
        >
          <Image
            src={imageUrl(img.path)}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
          />
          {i === 0 && (
            <span className="absolute bottom-0 inset-x-0 bg-black/50 py-0.5 text-center text-[10px] font-medium text-white">
              Cover
            </span>
          )}
          <button
            type="button"
            aria-label="Remove image"
            onClick={() => remove(img.path)}
            className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}

      {images.length < MAX_IMAGES && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex size-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          )}
        >
          <ImagePlus className="size-5" />
          <span className="text-[10px] font-medium">Add</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      <ImageProcessorDialog
        file={queue[0] ?? null}
        remaining={Math.max(0, queue.length - 1)}
        onAccept={upload}
        onCancel={() => setQueue([])}
      />
    </div>
  );
}
