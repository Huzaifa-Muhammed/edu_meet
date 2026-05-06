import "server-only";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) {
    throw new Error(
      "Cloudinary credentials missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.",
    );
  }
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  configured = true;
}

export type CloudinaryUpload = {
  url: string;
  publicId: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
};

export async function uploadImageBuffer(
  buffer: Buffer,
  opts: { folder: string; filename?: string },
): Promise<CloudinaryUpload> {
  ensureConfigured();
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: opts.folder,
        resource_type: "image",
        public_id: opts.filename
          ? opts.filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_")
          : undefined,
        overwrite: false,
        unique_filename: true,
      },
      (err, res) => {
        if (err || !res) return reject(err ?? new Error("Cloudinary upload failed"));
        resolve(res);
      },
    );
    stream.end(buffer);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
    format: result.format,
  };
}

export async function destroyImage(publicId: string) {
  ensureConfigured();
  await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}
