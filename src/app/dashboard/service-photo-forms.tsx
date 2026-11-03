"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Perbaikan bug 413 (3 Nov 2026): foto TIDAK
// lagi dikirim lewat Server Action, karena body Server Action Next.js
// dibatasi 1 MB dan foto HP normal (mis. JPG 1,4 MB) sudah gagal di
// depan sebelum kode server sempat jalan. Di sini foto diunggah
// langsung dari browser ke Supabase Storage, dan form server hanya
// menerima URL foto (teks pendek) sehingga body-nya jauh di bawah 1 MB.
// Server tetap memvalidasi URL-nya: harus dari bucket service-images
// dan path-nya harus cocok dengan jasa yang dibuat/ditambah fotonya.
const SERVICE_IMAGES_BUCKET = "service-images";
const MAX_PHOTOS_PER_UPLOAD = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function validateFiles(files: File[]): string | null {
  if (files.length > MAX_PHOTOS_PER_UPLOAD) {
    return `Maksimal ${MAX_PHOTOS_PER_UPLOAD} foto per unggahan.`;
  }
  for (const file of files) {
    if (!ALLOWED_PHOTO_TYPES[file.type]) {
      return "Foto harus berformat JPG, PNG, WebP, atau GIF.";
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return "Setiap foto maksimal 5 MB.";
    }
  }
  return null;
}

async function uploadFiles(
  serviceId: string,
  files: File[],
): Promise<{ urls: string[] } | { error: string }> {
  const supabase = createClient();
  const urls: string[] = [];
  const paths: string[] = [];
  for (const file of files) {
    const ext = ALLOWED_PHOTO_TYPES[file.type];
    const path = `${serviceId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(SERVICE_IMAGES_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      for (const uploaded of paths) {
        await supabase.storage.from(SERVICE_IMAGES_BUCKET).remove([uploaded]);
      }
      return {
        error:
          "Gagal mengunggah foto ke Storage. Pastikan bucket 'service-images' sudah ada di Supabase.",
      };
    }
    paths.push(path);
    urls.push(supabase.storage.from(SERVICE_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl);
  }
  return { urls };
}

export function CreateServicePhotoField() {
  // ID jasa digenerate di browser sekali, supaya path Storage foto dan
  // jasa yang dibuat server nanti cocok (server memvalidasi ini).
  const serviceIdRef = useRef<string>(crypto.randomUUID());
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const validationError = validateFiles(files);
    if (validationError) {
      setUploadError(validationError);
      event.target.value = "";
      return;
    }
    setUploading(true);
    setUploadError(null);
    const result = await uploadFiles(serviceIdRef.current, files);
    setUploading(false);
    if ("error" in result) {
      setUploadError(result.error);
      event.target.value = "";
      return;
    }
    setUploadedUrls((prev) => [...prev, ...result.urls].slice(0, 10));
    event.target.value = "";
  }

  return (
    <>
      <input type="hidden" name="client_service_id" value={serviceIdRef.current} />
      {uploadedUrls.map((url) => (
        <input key={url} type="hidden" name="photo_url" value={url} />
      ))}
      <div className="form-group">
        <label className="form-label" htmlFor="create_photos">
          Foto galeri jasa (opsional, maks. 5 foto per unggahan, masing-masing maks. 5 MB)
        </label>
        <input
          id="create_photos"
          name="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={handleFiles}
          className="form-input"
        />
        <span className="form-hint">
          Foto diunggah langsung dari browser ke Storage saat kamu memilihnya,
          jadi tidak lagi lewat Server Action (yang dibatasi 1 MB). Foto
          pertama menjadi sampul di katalog.
        </span>
        {uploading ? <p className="muted-copy">Mengunggah foto…</p> : null}
        {uploadError ? (
          <div className="alert alert-error" role="alert">
            {uploadError}
          </div>
        ) : null}
        {uploadedUrls.length > 0 ? (
          <p className="muted-copy">
            Foto terunggah: {uploadedUrls.length} foto. Foto akan disimpan
            bersama jasa saat kamu menekan “Simpan layanan jasa”.
          </p>
        ) : null}
      </div>
    </>
  );
}

export function AddServicePhotosField({
  services,
}: {
  services: { id: string; title: string }[];
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0 || !serviceId) return;
    const validationError = validateFiles(files);
    if (validationError) {
      setUploadError(validationError);
      event.target.value = "";
      return;
    }
    setUploading(true);
    setUploadError(null);
    const result = await uploadFiles(serviceId, files);
    setUploading(false);
    if ("error" in result) {
      setUploadError(result.error);
      event.target.value = "";
      return;
    }
    setUploadedUrls((prev) => [...prev, ...result.urls].slice(0, 10));
    event.target.value = "";
  }

  return (
    <>
      <div className="form-group">
        <label className="form-label" htmlFor="gallery_service_id">
          Pilih jasa
        </label>
        <select
          id="gallery_service_id"
          name="service_id"
          required
          value={serviceId}
          onChange={(event) => {
            setServiceId(event.target.value);
            setUploadedUrls([]);
            setUploadError(null);
          }}
          className="form-input"
        >
          {services.map((srv) => (
            <option key={srv.id} value={srv.id}>
              {srv.title}
            </option>
          ))}
        </select>
      </div>
      {uploadedUrls.map((url) => (
        <input key={url} type="hidden" name="photo_url" value={url} />
      ))}
      <div className="form-group">
        <label className="form-label" htmlFor="gallery_photos">
          Foto (maks. 5 foto per unggahan, total maks. 10 foto per jasa)
        </label>
        <input
          id="gallery_photos"
          name="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={handleFiles}
          className="form-input"
        />
        <span className="form-hint">
          Foto diunggah langsung dari browser ke Storage saat kamu memilihnya.
        </span>
        {uploading ? <p className="muted-copy">Mengunggah foto…</p> : null}
        {uploadError ? (
          <div className="alert alert-error" role="alert">
            {uploadError}
          </div>
        ) : null}
        {uploadedUrls.length > 0 ? (
          <p className="muted-copy">
            Foto terunggah: {uploadedUrls.length} foto. Foto akan disimpan
            saat kamu menekan “Tambah foto galeri”.
          </p>
        ) : null}
      </div>
    </>
  );
}
