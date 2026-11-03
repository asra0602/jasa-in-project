import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createOrderAction } from "@/app/orders/actions";

export const metadata: Metadata = {
  title: "Detail Layanan | Jasa-in",
  description: "Lihat detail layanan, harga, dan ulasan seller di Jasa-in.",
};

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

export default async function ServiceDetailPage({ params, searchParams }: ServiceDetailPageProps) {
  const { id } = await params;
  const { error: errorMessage } = await searchParams;

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
      description,
      category,
      price_idr,
      cover_image_url,
      created_at,
      seller_profiles (
        store_name,
        store_slug,
        bio
      )
    `
    )
    .eq("id", id)
    .eq("status", "published")
    .single();

  const seller = service
    ? Array.isArray(service.seller_profiles)
      ? service.seller_profiles[0]
      : service.seller_profiles
    : null;

  const { data: reviews } = service
    ? await supabase
        .from("reviews")
        .select("rating, comment, created_at")
        .eq("seller_id", service.seller_id)
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: null };

  const reviewCount = reviews?.length ?? 0;
  const averageRating =
    reviewCount > 0
      ? reviews!.reduce((sum, review) => sum + Number(review.rating), 0) / reviewCount
      : null;

  const isOwnService = Boolean(user && service && user.id === service.seller_id);

  return (
    <main className="page-shell">
      <nav className="nav" aria-label="Navigasi utama">
        <a className="brand" href="/" aria-label="Jasa-in beranda">
          jasa<span>-</span>in
        </a>
        <div className="nav-actions">
          <a className="nav-link" href="/catalog">
            Katalog
          </a>
          {user ? (
            <a className="button button-dark button-small" href="/dashboard">
              Dashboard
            </a>
          ) : (
            <>
              <a className="nav-link" href="/login">
                Masuk
              </a>
              <a className="button button-dark button-small" href="/register?role=seller">
                Mulai berjualan
              </a>
            </>
          )}
        </div>
      </nav>

      {errorMessage ? (
        <div className="alert alert-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {!service ? (
        <section className="empty-state" aria-live="polite">
          <h2>Layanan tidak ditemukan atau sedang tidak aktif.</h2>
          <p>Layanan ini mungkin sudah diarsipkan seller atau tautannya sudah berubah.</p>
          <div className="empty-state-actions">
            <a href="/catalog" className="button button-dark">
              Kembali ke katalog
            </a>
          </div>
        </section>
      ) : (
        <section className="detail-section">
          <div className="detail-grid">
            <div className="detail-main">
              <div>
                <p className="eyebrow">{service.category}</p>
                <h1 className="detail-title">{service.title}</h1>
                <p className="muted-copy">
                  Oleh {seller?.store_name ?? "Seller"}
                  {averageRating !== null
                    ? ` · ${averageRating.toFixed(1)} dari 5 (${reviewCount} ulasan)`
                    : null}
                </p>
              </div>

              {service.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="detail-thumb"
                  src={service.cover_image_url}
                  alt={`Sampul layanan ${service.title}`}
                />
              ) : null}

              <p className="detail-description">{service.description || "Seller belum menambahkan deskripsi untuk layanan ini."}</p>

              {seller ? (
                <div className="seller-box">
                  <h2>{seller.store_name}</h2>
                  <p>{seller.bio || "Seller belum menambahkan bio toko."}</p>
                </div>
              ) : null}

              {reviews && reviews.length > 0 ? (
                <div className="reviews-section">
                  <h2 className="section-heading">Ulasan untuk seller ini</h2>
                  <div className="reviews-list">
                    {reviews.map((review, index) => (
                      <div key={`${review.created_at}-${index}`} className="review-item">
                        <div className="review-header">
                          <span className="rating-badge">{review.rating} / 5</span>
                          <span className="muted-copy">
                            {new Date(review.created_at).toLocaleDateString("id-ID")}
                          </span>
                        </div>
                        <p>{review.comment || "Tanpa komentar."}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="checkout-card" aria-label="Pesan layanan ini">
              <div>
                <p className="eyebrow">HARGA LAYANAN</p>
                <div className="checkout-price">
                  {formatRupiah(Number(service.price_idr))} <span>/ pesanan</span>
                </div>
                <p className="muted-copy">
                  Biaya platform saat ini Rp0. Total dibayar di halaman pesanan setelah QRIS dibuat.
                </p>
              </div>

              {isOwnService ? (
                <div className="alert alert-error" role="alert">
                  Ini layanan tokomu sendiri, jadi kamu tidak dapat memesannya.
                </div>
              ) : user ? (
                <form action={createOrderAction} className="auth-form">
                  <input type="hidden" name="service_id" value={service.id} />
                  <div className="form-group">
                    <label className="form-label" htmlFor="quantity">
                      Jumlah
                    </label>
                    <input
                      id="quantity"
                      name="quantity"
                      type="number"
                      min="1"
                      max="50"
                      defaultValue="1"
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="buyer_notes">
                      Catatan untuk seller
                    </label>
                    <textarea
                      id="buyer_notes"
                      name="buyer_notes"
                      rows={4}
                      placeholder="Ceritakan kebutuhanmu, misalnya gaya edit yang diinginkan..."
                      className="form-textarea"
                    />
                  </div>
                  <button type="submit" className="button button-dark button-full">
                    Pesan & bayar via QRIS
                  </button>
                </form>
              ) : (
                <div>
                  <p className="muted-copy">
                    Masuk dulu untuk memesan layanan ini. Setelah masuk, kamu akan kembali ke halaman ini.
                  </p>
                  <a
                    href={`/login?next=${encodeURIComponent(`/catalog/${service.id}`)}`}
                    className="button button-dark button-full"
                  >
                    Masuk untuk memesan
                  </a>
                </div>
              )}

              <a href="/catalog" className="button button-light button-full">
                Kembali ke katalog
              </a>
            </aside>
          </div>
        </section>
      )}
    </main>
  );
}
