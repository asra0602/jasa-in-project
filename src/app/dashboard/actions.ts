"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildDummyStaticQris, validateStaticQrisPayload } from "@/lib/qris";

const STORE_SLUG_REGEX = /^[a-z0-9-]{3,40}$/;

// Galeri foto jasa: maksimal 5 foto per unggahan, maksimal 10 foto per
// jasa, masing-masing maksimal 5 MB, hanya gambar. Foto disimpan di
// bucket Storage Supabase "service-images" (migrasi 004) dan dicatat di
// tabel service_images; foto pertama juga menjadi cover_image_url agar
// katalog bisa menampilkan sampul.
const SERVICE_IMAGES_BUCKET = "service-images";
const MAX_PHOTOS_PER_UPLOAD = 5;
const MAX_PHOTOS_PER_SERVICE = 10;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function collectPhotoFiles(formData: FormData): File[] {
  return formData
    .getAll("photos")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

function validatePhotoFiles(files: File[]): string | null {
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

async function uploadServicePhotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  serviceId: string,
  files: File[],
): Promise<{ urls: string[]; paths: string[] } | { error: string }> {
  const urls: string[] = [];
  const paths: string[] = [];
  for (const file of files) {
    const ext = ALLOWED_PHOTO_TYPES[file.type];
    const path = `${serviceId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(SERVICE_IMAGES_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      // Hapus foto yang sudah terunggah supaya tidak ada file yatim.
      for (const uploaded of paths) {
        await supabase.storage.from(SERVICE_IMAGES_BUCKET).remove([uploaded]);
      }
      return {
        error:
          "Gagal mengunggah foto. Pastikan bucket Storage 'service-images' sudah diterapkan (migrasi 004).",
      };
    }
    paths.push(path);
    urls.push(supabase.storage.from(SERVICE_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl);
  }
  return { urls, paths };
}

function redirectDashboard(params: Record<string, string>): never {
  const search = new URLSearchParams(params);
  redirect(`/dashboard?${search.toString()}`);
}

function slugifyTitle(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export async function upgradeToSellerAction(formData: FormData) {
  const storeName = String(formData.get("store_name") ?? "").trim();
  const storeSlug = String(formData.get("store_slug") ?? "").trim().toLowerCase();
  const bio = String(formData.get("bio") ?? "").trim();
  const rawQris = String(formData.get("qris_static_payload") ?? "").trim();

  if (!storeName || !storeSlug) {
    redirectDashboard({ error: "Nama toko dan slug toko wajib diisi." });
  }

  if (!STORE_SLUG_REGEX.test(storeSlug)) {
    redirectDashboard({
      error: "Slug toko harus 3-40 karakter (huruf kecil, angka, atau tanda hubung).",
    });
  }

  if (rawQris) {
    const check = validateStaticQrisPayload(rawQris);
    if (!check.valid) {
      redirectDashboard({
        error: check.error ?? "Payload QRIS statis tidak valid.",
      });
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_as_seller", {
    p_store_name: storeName,
    p_store_slug: storeSlug,
    p_bio: bio,
    p_qris_static_payload: rawQris || null,
  });

  if (error) {
    redirectDashboard({
      error: "Gagal menyimpan profil toko. Pastikan slug toko belum digunakan.",
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/catalog");
  redirectDashboard({ message: "Toko seller berhasil diaktifkan." });
}

export async function updateSellerStoreAction(formData: FormData) {
  const storeName = String(formData.get("store_name") ?? "").trim();
  const storeSlug = String(formData.get("store_slug") ?? "").trim().toLowerCase();
  const bio = String(formData.get("bio") ?? "").trim();
  const useDummyQris = formData.get("use_dummy_qris") === "1";
  const rawQris = useDummyQris
    ? buildDummyStaticQris()
    : String(formData.get("qris_static_payload") ?? "").trim();

  if (!storeName || !storeSlug) {
    redirectDashboard({ error: "Nama toko dan slug toko wajib diisi." });
  }

  if (!STORE_SLUG_REGEX.test(storeSlug)) {
    redirectDashboard({
      error: "Slug toko harus 3-40 karakter (huruf kecil, angka, atau tanda hubung).",
    });
  }

  if (rawQris) {
    const check = validateStaticQrisPayload(rawQris);
    if (!check.valid) {
      redirectDashboard({
        error: check.error ?? "Payload QRIS statis tidak valid.",
      });
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("seller_profiles")
    .update({
      store_name: storeName,
      store_slug: storeSlug,
      bio,
      qris_static_payload: rawQris || null,
      qris_enabled: Boolean(rawQris),
    })
    .eq("user_id", user.id);

  if (error) {
    redirectDashboard({
      error: "Gagal memperbarui pengaturan toko. Periksa kembali slug toko.",
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/catalog");
  redirectDashboard({
    message: useDummyQris
      ? "Pengaturan toko dan payload QRIS contoh berhasil disimpan."
      : "Pengaturan toko dan QRIS berhasil diperbarui.",
  });
}

export async function createServiceAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priceIdr = Number.parseInt(String(formData.get("price_idr") ?? "0"), 10);
  const status = String(formData.get("status") ?? "published") === "draft" ? "draft" : "published";

  if (!title || !category || !description) {
    redirectDashboard({ error: "Judul, kategori, dan deskripsi jasa wajib diisi." });
  }

  if (!Number.isFinite(priceIdr) || priceIdr < 1000) {
    redirectDashboard({ error: "Harga jasa minimal Rp 1.000." });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const photos = collectPhotoFiles(formData);
  const photoError = validatePhotoFiles(photos);
  if (photoError) {
    redirectDashboard({ error: photoError });
  }

  const baseSlug = slugifyTitle(title) || "jasa";
  const uniqueSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  const serviceId = crypto.randomUUID();

  let photoUrls: string[] = [];
  if (photos.length > 0) {
    const uploaded = await uploadServicePhotos(supabase, serviceId, photos);
    if ("error" in uploaded) {
      redirectDashboard({ error: uploaded.error });
    }
    photoUrls = uploaded.urls;
  }

  const { error } = await supabase.from("services").insert({
    id: serviceId,
    seller_id: user.id,
    title,
    slug: uniqueSlug,
    category,
    description,
    price_idr: priceIdr,
    status,
    cover_image_url: photoUrls[0] ?? null,
  });

  if (error) {
    // Jasa gagal dibuat: hapus foto yang sudah terunggah.
    if (photoUrls.length > 0) {
      const paths = photoUrls.map((url) => url.split(`/${SERVICE_IMAGES_BUCKET}/`)[1]).filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from(SERVICE_IMAGES_BUCKET).remove(paths);
      }
    }
    redirectDashboard({ error: "Gagal menambahkan jasa baru. Pastikan profil toko sudah aktif." });
  }

  if (photoUrls.length > 0) {
    const { error: imagesError } = await supabase.from("service_images").insert(
      photoUrls.map((imageUrl, index) => ({
        service_id: serviceId,
        image_url: imageUrl,
        sort_order: index,
      })),
    );
    if (imagesError) {
      // Galeri gagal dicatat: hapus jasa + foto supaya tidak ada data
      // setengah jadi (jasa tanpa galeri).
      await supabase.from("services").delete().eq("id", serviceId);
      const paths = photoUrls.map((url) => url.split(`/${SERVICE_IMAGES_BUCKET}/`)[1]).filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from(SERVICE_IMAGES_BUCKET).remove(paths);
      }
      redirectDashboard({ error: "Gagal menyimpan galeri foto jasa." });
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/catalog");
  redirectDashboard({ message: "Layanan jasa baru berhasil ditambahkan." });
}

export async function addServicePhotosAction(formData: FormData) {
  const serviceId = String(formData.get("service_id") ?? "").trim();
  const photos = collectPhotoFiles(formData);
  const photoError = validatePhotoFiles(photos);
  if (!serviceId || photoError) {
    redirectDashboard({ error: photoError ?? "Pilih jasa yang akan ditambah fotonya." });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: service } = await supabase
    .from("services")
    .select("id, cover_image_url")
    .eq("id", serviceId)
    .eq("seller_id", user.id)
    .single();
  if (!service) {
    redirectDashboard({ error: "Hanya seller pemilik jasa yang dapat menambah fotonya." });
  }

  const { count } = await supabase
    .from("service_images")
    .select("id", { count: "exact", head: true })
    .eq("service_id", serviceId);
  if ((count ?? 0) + photos.length > MAX_PHOTOS_PER_SERVICE) {
    redirectDashboard({
      error: `Galeri jasa maksimal ${MAX_PHOTOS_PER_SERVICE} foto.`,
    });
  }

  const uploaded = await uploadServicePhotos(supabase, serviceId, photos);
  if ("error" in uploaded) {
    redirectDashboard({ error: uploaded.error });
  }

  const startOrder = count ?? 0;
  const { error: imagesError } = await supabase.from("service_images").insert(
    uploaded.urls.map((imageUrl, index) => ({
      service_id: serviceId,
      image_url: imageUrl,
      sort_order: startOrder + index,
    })),
  );
  if (imagesError) {
    const paths = uploaded.urls.map((url) => url.split(`/${SERVICE_IMAGES_BUCKET}/`)[1]).filter(Boolean);
    if (paths.length > 0) {
      await supabase.storage.from(SERVICE_IMAGES_BUCKET).remove(paths);
    }
    redirectDashboard({ error: "Gagal menyimpan galeri foto jasa." });
  }

  if (!service.cover_image_url && uploaded.urls[0]) {
    await supabase
      .from("services")
      .update({ cover_image_url: uploaded.urls[0] })
      .eq("id", serviceId)
      .eq("seller_id", user.id);
  }

  revalidatePath("/dashboard");
  revalidatePath("/catalog");
  revalidatePath(`/catalog/${serviceId}`);
  redirectDashboard({ message: "Foto galeri berhasil ditambahkan." });
}

export async function toggleServiceStatusAction(formData: FormData) {
  const serviceId = String(formData.get("service_id") ?? "").trim();
  const nextStatus = String(formData.get("next_status") ?? "published").trim();

  if (!serviceId || !["draft", "published", "archived"].includes(nextStatus)) {
    redirectDashboard({ error: "Permintaan perubahan status jasa tidak valid." });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("services")
    .update({ status: nextStatus })
    .eq("id", serviceId)
    .eq("seller_id", user.id);

  if (error) {
    redirectDashboard({ error: "Gagal mengubah status jasa." });
  }

  revalidatePath("/dashboard");
  revalidatePath("/catalog");
  redirectDashboard({ message: "Status layanan berhasil diperbarui." });
}