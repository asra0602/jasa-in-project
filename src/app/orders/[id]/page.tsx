import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  confirmOrderPaymentAction,
  submitPaymentProofAction,
  submitReviewAction,
  updateOrderStatusAction,
} from "@/app/orders/actions";
import { parseQrisTlv, validateQrisPayload } from "@/lib/qris";

export const metadata: Metadata = {
  title: "Detail Pesanan & Pembayaran QRIS | Jasa-in",
  description: "Pantau status pengerjaan pesanan dan selesaikan pembayaran QRIS Dinamis.",
};

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function OrderDetailPage({ params, searchParams }: OrderDetailPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const errorMessage = query.error;
  const infoMessage = query.message;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/orders/${id}`);
  }

  const { data: order } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      buyer_id,
      seller_id,
      status,
      subtotal_idr,
      platform_fee_idr,
      total_idr,
      buyer_notes,
      created_at,
      seller_profiles (
        store_name,
        store_slug
      )
    `
    )
    .eq("id", id)
    .single();

  if (!order || (order.buyer_id !== user.id && order.seller_id !== user.id)) {
    notFound();
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("id, service_title_snapshot, unit_price_idr, quantity, line_total_idr")
    .eq("order_id", order.id);

  const { data: payment } = await supabase
    .from("payments")
    .select("id, amount_idr, status, qris_payload, proof_image_path, confirmed_at")
    .eq("order_id", order.id)
    .maybeSingle();

  const { data: existingReview } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at")
    .eq("order_id", order.id)
    .maybeSingle();

  const isBuyer = user.id === order.buyer_id;
  const isSeller = user.id === order.seller_id;
  const seller = Array.isArray(order.seller_profiles)
    ? order.seller_profiles[0]
    : order.seller_profiles;

  const qrisInfo = payment?.qris_payload ? validateQrisPayload(payment.qris_payload) : null;
  const qrisTlv = payment?.qris_payload ? parseQrisTlv(payment.qris_payload) : null;

  return (
    <main className="page-shell">
      <nav className="nav" aria-label="Navigasi utama">
        <a className="brand" href="/" aria-label="Jasa-in beranda">
          jasa<span>-</span>in
        </a>
        <div className="nav-actions">
          <a className="nav-link" href="/dashboard">
            Kembali ke Dashboard
          </a>
          <a className="nav-link" href="/catalog">
            Katalog
          </a>
        </div>
      </nav>

      <section className="detail-section">
        <header className="order-header">
          <div>
            <p className="eyebrow">TRANSAKSI PESANAN</p>
            <h1>{order.order_number}</h1>
            <p className="muted-copy">
              Toko Seller: <strong>{seller?.store_name ?? "Seller"}</strong> | Peran kamu:{" "}
              <strong>{isBuyer ? "Pembeli" : "Seller"}</strong>
            </p>
          </div>
          <div className="order-status-box">
            <span>Status Pesanan</span>
            <strong className="status-pill">{order.status}</strong>
          </div>
        </header>

        {errorMessage ? (
          <div className="alert alert-error" role="alert">
            {errorMessage}
          </div>
        ) : null}

        {infoMessage ? (
          <div className="alert alert-success" role="status">
            {infoMessage}
          </div>
        ) : null}

        <div className="detail-grid">
          <div className="detail-main">
            <div className="auth-card">
              <p className="eyebrow">RINCIAN LAYANAN</p>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Layanan</th>
                      <th>Harga Satuan</th>
                      <th>Jumlah</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items?.map((item) => (
                      <tr key={item.id}>
                        <td>{item.service_title_snapshot}</td>
                        <td>{formatRupiah(Number(item.unit_price_idr))}</td>
                        <td>{item.quantity}</td>
                        <td>{formatRupiah(Number(item.line_total_idr))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="order-notes-box">
                <strong>Catatan Pembeli:</strong>
                <p>{order.buyer_notes || "Tidak ada catatan tambahan."}</p>
              </div>
            </div>

            {isSeller ? (
              <div className="auth-card">
                <p className="eyebrow">PANEL KONTROL SELLER</p>
                <h2>Kelola progres pengerjaan</h2>
                <div className="hero-actions">
                  {order.status === "paid" ? (
                    <form action={updateOrderStatusAction}>
                      <input type="hidden" name="order_id" value={order.id} />
                      <input type="hidden" name="next_status" value="in_progress" />
                      <button type="submit" className="button button-dark">
                        Mulai kerjakan (In Progress)
                      </button>
                    </form>
                  ) : null}

                  {order.status === "in_progress" ? (
                    <form action={updateOrderStatusAction}>
                      <input type="hidden" name="order_id" value={order.id} />
                      <input type="hidden" name="next_status" value="delivered" />
                      <button type="submit" className="button button-dark">
                        Tandai hasil terkirim (Delivered)
                      </button>
                    </form>
                  ) : null}

                  {order.status !== "paid" && order.status !== "in_progress" ? (
                    <p className="muted-copy">
                      Tombol progres pengerjaan aktif setelah pembayaran dikonfirmasi (status{" "}
                      <code>paid</code> atau <code>in_progress</code>).
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {isBuyer && order.status === "delivered" ? (
              <div className="auth-card">
                <p className="eyebrow">KONFIRMASI HASIL KERJA</p>
                <h2>Seller telah mengirimkan hasil pekerjaan</h2>
                <p className="muted-copy">
                  Jika hasil pekerjaan sudah sesuai kesepakatan, selesaikan pesanan agar kamu dapat memberikan ulasan.
                </p>
                <form action={updateOrderStatusAction}>
                  <input type="hidden" name="order_id" value={order.id} />
                  <input type="hidden" name="next_status" value="completed" />
                  <button type="submit" className="button button-dark">
                    Selesaikan pesanan (Completed)
                  </button>
                </form>
              </div>
            ) : null}

            {order.status === "completed" ? (
              <div className="auth-card">
                <p className="eyebrow">ULASAN TRANSAKSI</p>
                {existingReview ? (
                  <div>
                    <h2>Ulasan telah dikirim ({existingReview.rating}/5)</h2>
                    <p>{existingReview.comment}</p>
                  </div>
                ) : isBuyer ? (
                  <form action={submitReviewAction} className="auth-form">
                    <input type="hidden" name="order_id" value={order.id} />
                    <input type="hidden" name="seller_id" value={order.seller_id} />
                    <div className="form-group">
                      <label className="form-label" htmlFor="rating">
                        Penilaian (1 sampai 5)
                      </label>
                      <select id="rating" name="rating" defaultValue="5" className="form-input">
                        <option value="5">5 - Sangat memuaskan</option>
                        <option value="4">4 - Baik</option>
                        <option value="3">3 - Cukup</option>
                        <option value="2">2 - Kurang</option>
                        <option value="1">1 - Buruk</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="comment">
                        Komentar ulasan
                      </label>
                      <textarea
                        id="comment"
                        name="comment"
                        rows={3}
                        required
                        placeholder="Bagikan pengalamanmu bekerja sama dengan seller ini..."
                        className="form-textarea"
                      />
                    </div>
                    <button type="submit" className="button button-dark">
                      Kirim ulasan
                    </button>
                  </form>
                ) : (
                  <p className="muted-copy">Menunggu pembeli memberikan ulasan.</p>
                )}
              </div>
            ) : null}
          </div>

          <aside className="checkout-card" aria-label="Informasi pembayaran QRIS">
            <p className="eyebrow">PEMBAYARAN QRIS DINAMIS</p>
            <div className="checkout-price">{formatRupiah(Number(order.total_idr))}</div>
            <p className="muted-copy">
              Status Pembayaran: <strong>{payment?.status ?? "pending"}</strong>
            </p>

            {payment?.qris_payload ? (
              <div className="qris-payload-box">
                <div className="qris-meta">
                  <span>Merchant (Tag 59): {qrisInfo?.merchantName ?? "-"}</span>
                  <span>Kota (Tag 60): {qrisInfo?.merchantCity ?? "-"}</span>
                  <span>Tag 01 (Mode): {qrisTlv?.["01"] ?? "-"} (Dinamis)</span>
                  <span>Tag 54 (Nominal): Rp {qrisTlv?.["54"] ?? "-"}</span>
                  <span>Tag 63 (CRC16): {qrisTlv?.["63"] ?? "-"}</span>
                </div>
                <label className="form-label" htmlFor="qris-raw">
                  Payload String QRIS Dinamis
                </label>
                <textarea
                  id="qris-raw"
                  readOnly
                  rows={4}
                  value={payment.qris_payload}
                  className="form-textarea qris-mono"
                />
              </div>
            ) : (
              <div className="alert alert-error">
                Seller belum mengatur payload QRIS Statis di tokonya. Hubungi seller atau minta seller mengaktifkan QRIS di Dashboard.
              </div>
            )}

            {payment?.proof_image_path ? (
              <div className="order-notes-box">
                <strong>Referensi / Bukti Pembayaran:</strong>
                <p>{payment.proof_image_path}</p>
              </div>
            ) : null}

            {isBuyer && payment?.status !== "confirmed" ? (
              <form action={submitPaymentProofAction} className="auth-form">
                <input type="hidden" name="order_id" value={order.id} />
                <div className="form-group">
                  <label className="form-label" htmlFor="proof_image_path">
                    Nomor referensi RRN / tautan bukti bayar QRIS
                  </label>
                  <input
                    id="proof_image_path"
                    name="proof_image_path"
                    type="text"
                    required
                    defaultValue={payment?.proof_image_path ?? ""}
                    placeholder="Contoh: RRN 429100281921 atau URL tangkapan layar"
                    className="form-input"
                  />
                </div>
                <button type="submit" className="button button-dark button-full">
                  Kirim konfirmasi pembayaran
                </button>
              </form>
            ) : null}

            {isSeller && payment?.status === "submitted" ? (
              <div className="seller-verify-box">
                <p className="seller-fields-title">Verifikasi Pembayaran Pembeli</p>
                <div className="hero-actions">
                  <form action={confirmOrderPaymentAction}>
                    <input type="hidden" name="order_id" value={order.id} />
                    <input type="hidden" name="decision" value="confirm" />
                    <button type="submit" className="button button-dark button-small">
                      Terima pembayaran
                    </button>
                  </form>
                  <form action={confirmOrderPaymentAction}>
                    <input type="hidden" name="order_id" value={order.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <button type="submit" className="button button-light button-small">
                      Tolak
                    </button>
                  </form>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}