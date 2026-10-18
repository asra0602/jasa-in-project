"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildDummyStaticQris, validateQrisPayload } from "@/lib/qris";

const STORE_SLUG_REGEX = /^[a-z0-9-]{3,40}$/;

function redirectDashboard(params: Record<string, string>) {
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
    const check = validateQrisPayload(rawQris);
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
    const check = validateQrisPayload(rawQris);
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

  const baseSlug = slugifyTitle(title) || "jasa";
  const uniqueSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

  const { error } = await supabase.from("services").insert({
    seller_id: user.id,
    title,
    slug: uniqueSlug,
    category,
    description,
    price_idr: priceIdr,
    status,
  });

  if (error) {
    redirectDashboard({ error: "Gagal menambahkan jasa baru. Pastikan profil toko sudah aktif." });
  }

  revalidatePath("/dashboard");
  revalidatePath("/catalog");
  redirectDashboard({ message: "Layanan jasa baru berhasil ditambahkan." });
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