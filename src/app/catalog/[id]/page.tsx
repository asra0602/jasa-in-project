import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createOrderAction } from "@/app/orders/actions";

interface ServiceDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function generateMetadata({ params }: ServiceDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: service } = await supabase
    .from("services")
    .select("title, description")
    .eq("id", id)
    .single();

  return {
    title: service ? `${service.title} | Jasa-in` : "Detail Layanan | Jasa-in",
    description: service?.description ?? "Pesan jasa digital dari seller independen di Jasa-in.",
  };
}

export default async function ServiceDetailPage({ params, searchParams }: ServiceDetailPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const errorMessage = query.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: service } = await supabase
    .from("services")
    .select(
      `
      id,
      seller_id,
      title,
      slug,
      description,
      category,
      price_idr,
      status,
      seller_profiles (
        store_name,
        store_slug,
        bio,
        qris_enabled
      )
    `
    )
    .eq("id", id)
    .single();

  if (!service || (service.status !== "published" && service.seller_id !== user?.id)) {
    notFound();
  }

  const seller = Array.isArray(service.seller_profiles)
    ? service.seller_profiles[0]
    : service.seller_profiles;

  const { data: reviews } = await supabase
    .from("reviews")
    .select(
      `
      id,
      rating,
      comment,
      created_at,
      profiles:buyer_id (
        display_name
      )
    `
    )
    .eq("seller_id", service.seller_id)
    .order("created_at", { ascending: false })
    .limit(10);

  const isOwnService = user?.id === service.seller_id;

  return (
    <main className="page-shell">
      <nav className="nav" aria-label="Navigasi utama">
        <a className="brand" href="/" aria-label="Jasa-in beranda">
          jasa<span>-</span>in
        </a>
        <div className="nav-actions">
          <a className="nav-link" href="/catalog">
            Kembali ke Katalog
          </a>
          {user ? (
            <a className="button button-dark button-small" href="/dashboard">
              Dashboard
            </a>
          ) : (
            <a className="button button-dark button-small" href={`/login?next=/catalog/${service.id}`}>
              Masuk
            </a>
          )}
        </div>
      </nav>

      <section className="detail-section">
        <div className="detail-grid">
          <div className="detail-main">
            <div className="service-card-top">
              <span className="service-category">{service.category}</span>
              {seller?.qris_enabled ? (
                <span className="qris-tag">Mendukung QRIS Dinamis</span>
              ) : null}
            </div>

            <h1 className="detail-title">{service.title}</h1>
            <p className="detail-description">{service.description}</p>

            <div className="seller-box">
              <p className="eyebrow">PROFIL PENYEDIA JASA</p>
              <h2>{seller?.store_name ?? "Toko Seller"}</h2>
              <p>{seller?.bio || "Seller independen terverifikasi di Jasa-in."}</p>
            </div>

            <div className="reviews-section">
              <p className="eyebrow">ULASAN PEMBELI TOKO INI</p>
              {!reviews || reviews.length === 0 ? (
                <p className="muted-copy">
                  Belum ada ulasan untuk toko ini. Ulasan hanya dapat ditulis oleh pembeli setelah pesanan selesai.
                </p>
              ) : (
                <div className="reviews-list">
                  {reviews.map((rev) => {
                    const buyerProfile = Array.isArray(rev.profiles) ? rev.profiles[0] : rev.profiles;
                    return (
                      <article key={rev.id} className="review-item">
                        <div className="review-header">
                          <strong>{buyerProfile?.display_name || "Pembeli"}</strong>
                          <span className="rating-badge">Rating {rev.rating}/5</span>
                        </div>
                        <p>{rev.comment || "Pesanan diselesaikan dengan baik."}</p>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <aside className="checkout-card" aria-label="Formulir pemesanan jasa">
            <p className="eyebrow">RINGKASAN BIAYA</p>
            <div className="checkout-price">
              {formatRupiah(Number(service.price_idr))}
              <span> / paket</span>
            </div>

            {errorMessage ? (
              <div className="alert alert-error" role="alert">
                {errorMessage}
              </div>
            ) : null}

            {isOwnService ? (
              <div className="alert alert-success">
                Ini adalah layanan milik tokomu sendiri. Kelola status atau harga layanan melalui{" "}
                <a href="/dashboard" className="auth-switch-link">
                  Dashboard Seller
                </a>
                .
              </div>
            ) : user ? (
              <form action={createOrderAction} className="auth-form">
                <input type="hidden" name="service_id" value={service.id} />

                <div className="form-group">
                  <label className="form-label" htmlFor="quantity">
                    Jumlah paket pesanan
                  </label>
                  <input
                    id="quantity"
                    name="quantity"
                    type="number"
                    min={1}
                    max={50}
                    defaultValue={1}
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="buyer_notes">
                    Catatan kebutuhan untuk seller
                  </label>
                  <textarea
                    id="buyer_notes"
                    name="buyer_notes"
                    rows={4}
                    required
                    placeholder="Jelaskan detail permintaan, referensi gaya, ukuran file, atau tenggat waktu yang kamu harapkan..."
                    className="form-textarea"
                  />
                </div>

                <button type="submit" className="button button-dark button-full">
                  Buat pesanan & lanjut ke QRIS
                </button>
              </form>
            ) : (
              <div className="auth-form">
                <p className="muted-copy">
                  Masuk ke akun Jasa-in terlebih dahulu untuk memesan layanan ini dan membuat kode pembayaran QRIS Dinamis.
                </p>
                <a
                  href={`/login?next=${encodeURIComponent(`/catalog/${service.id}`)}`}
                  className="button button-dark button-full"
                >
                  Masuk untuk memesan
                </a>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}