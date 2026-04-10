import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";

export type ImageUploadType = "avatar" | "event";

interface UploadConfig {
  bucket: "avatars" | "event-images";
  maxWidthOrHeight: number;
  maxSizeMB: number;
}

const CONFIG: Record<ImageUploadType, UploadConfig> = {
  avatar: {
    bucket: "avatars",
    maxWidthOrHeight: 400,
    maxSizeMB: 0.1, // ~100KB target
  },
  event: {
    bucket: "event-images",
    maxWidthOrHeight: 1200,
    maxSizeMB: 0.4, // ~400KB target
  },
};

/**
 * Compresses an image client-side and uploads it to Supabase Storage.
 *
 * @param file - The image file to upload
 * @param type - "avatar" or "event" — determines bucket and sizing
 * @param path - Storage path without extension (e.g. `${userId}/avatar`)
 * @returns The public URL of the uploaded image
 */
export async function uploadImage(
  file: File,
  type: ImageUploadType,
  path: string,
): Promise<string> {
  const config = CONFIG[type];

  const compressed = await imageCompression(file, {
    maxSizeMB: config.maxSizeMB,
    maxWidthOrHeight: config.maxWidthOrHeight,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.85,
  });

  const supabase = createClient();
  const fullPath = `${path}.jpg`;

  const { error } = await supabase.storage
    .from(config.bucket)
    .upload(fullPath, compressed, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "3600",
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(config.bucket).getPublicUrl(fullPath);
  return data.publicUrl;
}
