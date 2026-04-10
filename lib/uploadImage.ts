import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";

export type ImageUploadType = "avatar" | "event";

interface UploadConfig {
  bucket: "avatars" | "event-images";
  maxWidthOrHeight: number;
  maxSizeMB: number;
}

// maxSizeMB is a safety ceiling, not a target. The real size control comes
// from maxWidthOrHeight + initialQuality — setting maxSizeMB too low makes
// the library iteratively crush quality to hit the byte target.
const CONFIG: Record<ImageUploadType, UploadConfig> = {
  avatar: {
    bucket: "avatars",
    maxWidthOrHeight: 400,
    maxSizeMB: 1,
  },
  event: {
    bucket: "event-images",
    maxWidthOrHeight: 1200,
    maxSizeMB: 2,
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
    initialQuality: 0.9,
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
