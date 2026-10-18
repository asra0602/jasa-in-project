"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { makeDynamicQris } from "@/lib/qris";

function buildOrderNumber(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `JSA-${y}${m}${d}-${rand}`;
}

export async function createOrderAction(formData: FormData) {
  const serviceId = String(formData.get("service_id") ?? "").trim();
  const quantity = Number.parseInt(String(formData.get("quantity") ?? "1"), 10);
  const buyerNotes = String(formData.get("buyer_notes") ?? "").trim();

  if (!serviceId || !Number.isFinite(quantity) || quantity < 1 || quantity > 50) {
    redirect(`/catalog?error=${encodeURIComponent("Jumlah pesanan tidak valid.")}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/catalog/${serviceId}`)}`);
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, seller_id, title, price_idr, status")
    .eq("id", serviceId)
    .eq("status", "published")
    .single();

  if (serviceError || !service) {
    redirect(`/catalog?error=${encodeURIComponent("Layanan tidak ditemukan atau sedang tidak aktif.")}`);
  }

  if (service.seller_id === user.id) {
    redirect(
      `/catalog/${serviceId}?error=${encodeURIComponent("Kamu tidak dapat memesan layanan milik tokomu sendiri.")}`
    );
  }

  const { data: sellerProfile } = await supabase
    .from("seller_profiles")
    .select("qris_static_payload, qris_enabled")
    .eq("user_id", service.seller_id)
    .single();

  const unitPrice = Number(service.price_idr);
  const subtotalIdr = unitPrice * quantity;
  const platformFeeIdr = 0;
  const totalIdr = subtotalIdr + platformFeeIdr;
  const orderNumber = buildOrderNumber();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      buyer_id: user.id,
      seller_id: service.seller_id,
      status: "pending_payment",
      subtotal_idr: subtotalIdr,
      platform_fee_idr: platformFeeIdr,
      total_idr: totalIdr,
      buyer_notes: buyerNotes,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    redirect(
      `/catalog/${serviceId}?error=${encodeURIComponent("Gagal membuat pesanan. Silakan coba beberapa saat lagi.")}`
    );
  }

  const { error: itemError } = await supabase.from("order_items").insert({
    order_id: order.id,
    service_id: service.id,
    service_title_snapshot: service.title,
    unit_price_idr: unitPrice,
    quantity,
    line_total_idr: subtotalIdr,
  });

  if (itemError) {
    redirect(`/orders/${order.id}?error=${encodeURIComponent("Detail item pesanan gagal disimpan.")}`);
  }

  let dynamicQris: string | null = null;
  if (sellerProfile?.qris_enabled && sellerProfile.qris_static_payload) {
    try {
      dynamicQris = makeDynamicQris(sellerProfile.qris_static_payload, totalIdr);
    } catch {
      dynamicQris = null;
    }
  }

  await supabase.from("payments").insert({
    order_id: order.id,
    seller_id: service.seller_id,
    amount_idr: totalIdr,
    status: "pending",
    qris_payload: dynamicQris,
  });

  revalidatePath("/dashboard");
  redirect(`/orders/${order.id}`);
}

export async function submitPaymentProofAction(formData: FormData) {
  const orderId = String(formData.get("order_id") ?? "").trim();
  const proofReference = String(formData.get("proof_image_path") ?? "").trim();

  if (!orderId || !proofReference) {
    redirect(
      `/orders/${orderId}?error=${encodeURIComponent("Masukkan nomor referensi atau tautan bukti pembayaran QRIS.")}`
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("payments")
    .update({
      proof_image_path: proofReference,
      status: "submitted",
    })
    .eq("order_id", orderId);

  if (error) {
    redirect(`/orders/${orderId}?error=${encodeURIComponent("Gagal mengirim bukti pembayaran.")}`);
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/dashboard");
  redirect(`/orders/${orderId}?message=${encodeURIComponent("Bukti pembayaran berhasil dikirim. Menunggu verifikasi seller.")}`);
}

export async function confirmOrderPaymentAction(formData: FormData) {
  const orderId = String(formData.get("order_id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();

  if (!orderId || !["confirm", "reject"].includes(decision)) {
    redirect(`/dashboard?error=${encodeURIComponent("Keputusan verifikasi pembayaran tidak valid.")}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (decision === "confirm") {
    await supabase
      .from("payments")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      })
      .eq("order_id", orderId)
      .eq("seller_id", user.id);

    await supabase
      .from("orders")
      .update({ status: "paid" })
      .eq("id", orderId)
      .eq("seller_id", user.id);
  } else {
    await supabase
      .from("payments")
      .update({ status: "rejected" })
      .eq("order_id", orderId)
      .eq("seller_id", user.id);
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/dashboard");
  redirect(
    `/orders/${orderId}?message=${encodeURIComponent(
      decision === "confirm" ? "Pembayaran berhasil dikonfirmasi." : "Pembayaran ditolak."
    )}`
  );
}

export async function updateOrderStatusAction(formData: FormData) {
  const orderId = String(formData.get("order_id") ?? "").trim();
  const nextStatus = String(formData.get("next_status") ?? "").trim();

  if (
    !orderId ||
    !["in_progress", "delivered", "completed", "cancelled"].includes(nextStatus)
  ) {
    redirect(`/dashboard?error=${encodeURIComponent("Perubahan status pesanan tidak valid.")}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: nextStatus })
    .eq("id", orderId);

  if (error) {
    redirect(`/orders/${orderId}?error=${encodeURIComponent("Gagal memperbarui status pesanan.")}`);
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/dashboard");
  redirect(`/orders/${orderId}?message=${encodeURIComponent("Status pesanan berhasil diperbarui.")}`);
}

export async function submitReviewAction(formData: FormData) {
  const orderId = String(formData.get("order_id") ?? "").trim();
  const sellerId = String(formData.get("seller_id") ?? "").trim();
  const rating = Number.parseInt(String(formData.get("rating") ?? "5"), 10);
  const comment = String(formData.get("comment") ?? "").trim();

  if (!orderId || !sellerId || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    redirect(`/orders/${orderId}?error=${encodeURIComponent("Rating ulasan harus bernilai antara 1 sampai 5.")}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.from("reviews").insert({
    order_id: orderId,
    buyer_id: user.id,
    seller_id: sellerId,
    rating,
    comment,
  });

  if (error) {
    redirect(
      `/orders/${orderId}?error=${encodeURIComponent("Gagal menyimpan ulasan. Pastikan pesanan sudah selesai dan belum pernah diulas.")}`
    );
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/catalog");
  redirect(`/orders/${orderId}?message=${encodeURIComponent("Terima kasih, ulasan kamu sudah diterbitkan.")}`);
}