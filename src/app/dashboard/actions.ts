"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildDummyStaticQris, validateStaticQrisPayload } from "@/lib/qris";

const STORE_SLUG_REGEX = /^[a-z0-9-]{3,40}$/;

// Galeri foto jasa (diperbaiki 3 Nov 2026, bug 413): foto TIDAK dikirim
// lewat Server Action, karena body Server Action dibatasi 1 MB dan foto
// HP normal sudah gagal sebelum kode server jalan. Foto diunggah
// langsung dari browser ke bucket Storage "service-images" (migrasi
// 004), lalu server hanya menerima URL foto (teks pendek) dan
// memvalidasinya di sini: URL harus dari bucket itu, host Supabase
// yang sama, dan path-nya harus diawali ID jasa yang bersangkutan.
// Foto pertama juga menjadi cover_image_url agar katalog menampilkan
// sampul. Maksimal 10 foto per jasa.
const SERVICE_IMAGES_BUCKET = "service-images";
const MAX_PHOTOS_PER_SERVICE = 10;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHOTO_URL_EXT_REGEX = /\.(jpg|png|webp|gif)$/i;

function collectPhotoUrls(formData: FormData): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const entry of formData.getAll("photo_url")) {
    const url = String(entry).trim();
    if (url && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  return urls;
}

function storagePathFromUrl(url: string): string | null {
  const marker = `/${SERVICE_IMAGES_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index < 0) return null;
  return url.slice(index + marker.length);
}

function validatePhotoUrls(urls: string[], serviceId: string): string | null {
  if (urls.length > MAX_PHOTOS_PER_SERVICE) {
    return `Galeri jasa maksimal ${MAX_PHOTOS_PER_SERVICE} foto.`;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return "Konfigurasi Supabase tidak ditemukan.";
  let supabaseHost: string;
  try {
    supabaseHost = new URL(supabaseUrl).host;
  } catch {
    return "Konfigurasi Supabase tidak valid.";
  }
  for (const url of urls) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return "URL foto tidak valid.";
    }
    if (parsed.protocol !== "https:" || parsed.host !== supabaseHost) {
      return "URL foto harus berasal dari Storage Supabase Jasa-in.";
    }
    if (!parsed.pathname.startsWith(`/storage/v1/object/public/${SERVICE_IMAGES_BUCKET}/${serviceId}/`)) {
      return "URL foto tidak cocok dengan jasa yang bersangkutan.";
    }
    if (!PHOTO_URL_EXT_REGEX.test(parsed.pathname)) {
      return "Foto harus berformat JPG, PNG, WebP, atau GIF.";
    }
  }
  return null;
}

async function removePhotoUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  urls: string[],
) {
  const paths = urls.map(storagePathFromUrl).filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    await supabase.storage.from(SERVICE_IMAGES_BUCKET).remove(paths);
  }
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

  // Foto sudah diunggah dari browser; server hanya menerima URL-nya.
  // Ini yang memperbaiki bug 413: tidak ada File di body Server Action.
  const photoUrls = collectPhotoUrls(formData);
  const clientServiceId = String(formData.get("client_service_id") ?? "").trim();
  if (photoUrls.length > 0) {
    if (!UUID_REGEX.test(clientServiceId)) {
      redirectDashboard({ error: "ID foto galeri tidak valid. Pilih ulang foto jasa." });
    }
    const urlError = validatePhotoUrls(photoUrls, clientServiceId);
    if (urlError) {
      redirectDashboard({ error: urlError });
    }
  }

  const baseSlug = slugifyTitle(title) || "jasa";
  const uniqueSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  const serviceId = photoUrls.length > 0 ? clientServiceId : crypto.randomUUID();

  if (photoUrls.length > 0) {
    // ID dari browser harus belum dipakai jasa lain.
    const { data: existing } = await supabase
      .from("services")
      .select("id")
      .eq("id", serviceId)
      .maybeSingle();
    if (existing) {
      redirectDashboard({ error: "ID foto galeri sudah dipakai. Pilih ulang foto jasa." });
    }
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
    // Jasa gagal dibuat: hapus foto yang sudah terunggah di browser.
    await removePhotoUrls(supabase, photoUrls);
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
      await removePhotoUrls(supabase, photoUrls);
      redirectDashboard({ error: "Gagal menyimpan galeri foto jasa." });
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/catalog");
  redirectDashboard({ message: "Layanan jasa baru berhasil ditambahkan." });
}

export async function addServicePhotosAction(formData: FormData) {
  const serviceId = String(formData.get("service_id") ?? "").trim();
  const photoUrls = collectPhotoUrls(formData);
  if (!serviceId || photoUrls.length === 0) {
    redirectDashboard({ error: "Pilih jasa dan foto yang akan ditambah." });
  }
  const urlError = validatePhotoUrls(photoUrls, serviceId);
  if (urlError) {
    redirectDashboard({ error: urlError });
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
  if ((count ?? 0) + photoUrls.length > MAX_PHOTOS_PER_SERVICE) {
    redirectDashboard({
      error: `Galeri jasa maksimal ${MAX_PHOTOS_PER_SERVICE} foto.`,
    });
  }

  const startOrder = count ?? 0;
  const { error: imagesError } = await supabase.from("service_images").insert(
    photoUrls.map((imageUrl, index) => ({
      service_id: serviceId,
      image_url: imageUrl,
      sort_order: startOrder + index,
    })),
  );
  if (imagesError) {
    await removePhotoUrls(supabase, photoUrls);
    redirectDashboard({ error: "Gagal menyimpan galeri foto jasa." });
  }

  if (!service.cover_image_url && photoUrls[0]) {
    await supabase
      .from("services")
      .update({ cover_image_url: photoUrls[0] })
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