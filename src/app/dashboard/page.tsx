import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "@/app/(auth)/actions";
import {
  createServiceAction,
  toggleServiceStatusAction,
  updateSellerStoreAction,
  upgradeToSellerAction,
} from "@/app/dashboard/actions";
import { SERVICE_CATEGORIES } from "@/app/catalog/page";
import { validateQrisPayload } from "@/lib/qris";

export const metadata: Metadata = {
  title: "Dashboard | Jasa-in",
  description: "Kelola pesanan, layanan katalog, dan pengaturan pembayaran QRIS di Jasa-in.",
};

interface DashboardPageProps {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const errorMessage = params.error;
  const infoMessage = params.message;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, username, role")
    .eq("id", user.id)
    .single();

  const { data: sellerProfile } = await supabase
    .from("seller_profiles")
    .select("user_id, store_name, store_slug, bio, qris_static_payload, qris_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  const isSeller = profile?.role === "seller" || profile?.role === "admin" || Boolean(sellerProfile);

  const { data: myServices } = isSeller
    ? await supabase
        .from("services")
        .select("id, title, category, price_idr, status, created_at")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false })
    : { data: null };

  const { data: incomingOrders } = isSeller
    ? await supabase
        .from("orders")
        .select("id, order_number, status, total_idr, created_at")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false })
    : { data: null };

  const { data: buyerOrders } = await supabase
    .from("orders")
    .select("id, order_number, status, total_idr, created_at")
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false });

  const qrisCheck = sellerProfile?.qris_static_payload
    ? validateQrisPayload(sellerProfile.qris_static_payload)
    : null;

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
          <form action={logoutAction}>
            <button type="submit" className="button button-light button-small">
              Keluar
            </button>
          </form>
        </div>
      </nav>

      <header className="dashboard-header">
        <div>
          <p className="eyebrow">DASHBOARD PENGGUNA</p>
          <h1>Halo, {profile?.display_name || user.email}</h1>
          <p className="muted-copy">
            Status akun: <strong>{isSeller ? "Seller & Pembeli" : "Pembeli"}</strong>
            {profile?.username ? ` (@${profile.username})` : ""}
          </p>
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

      <section className="dashboard-section" aria-labelledby="buyer-orders-heading">
        <div className="section-heading">
          <p className="eyebrow">PESANAN SAYA (SEBAGAI PEMBELI)</p>
          <h2 id="buyer-orders-heading">Riwayat pembelian jasa</h2>
        </div>

        {!buyerOrders || buyerOrders.length === 0 ? (
          <div className="empty-state-compact">
            <p>Kamu belum memiliki pesanan jasa yang aktif.</p>
            <a href="/catalog" className="button button-dark button-small">
              Cari jasa di katalog
            </a>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nomor Pesanan</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {buyerOrders.map((ord) => (
                  <tr key={ord.id}>
                    <td>
                      <strong>{ord.order_number}</strong>
                    </td>
                    <td>
                      <span className="status-pill">{ord.status}</span>
                    </td>
                    <td>{formatRupiah(Number(ord.total_idr))}</td>
                    <td>
                      <a href={`/orders/${ord.id}`} className="auth-switch-link">
                        Lihat detail & QRIS
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!isSeller ? (
        <section className="dashboard-section" aria-labelledby="upgrade-seller-heading">
          <div className="auth-card">
            <p className="eyebrow">MULAI BERJUALAN</p>
            <h2 id="upgrade-seller-heading">Aktifkan Toko Seller Kamu</h2>
            <p className="muted-copy">
              Buka toko untuk menerbitkan layanan jasa digital dan menerima pembayaran langsung melalui QRIS Dinamis milikmu.
            </p>
            <form action={upgradeToSellerAction} className="auth-form">
              <div className="form-group">
                <label className="form-label" htmlFor="store_name">
                  Nama toko
                </label>
                <input
                  id="store_name"
                  name="store_name"
                  type="text"
                  required
                  placeholder="Contoh: Studio Kayuh Digital"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="store_slug">
                  Slug URL toko
                </label>
                <input
                  id="store_slug"
                  name="store_slug"
                  type="text"
                  required
                  pattern="^[a-z0-9-]{3,40}$"
                  placeholder="contoh: studio-kayuh-digital"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="bio">
                  Deskripsi singkat toko
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  rows={3}
                  placeholder="Ceritakan keahlian dan layanan utama tokomu..."
                  className="form-textarea"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="qris_static_payload">
                  Payload string QRIS Statis (opsional, bisa diatur nanti)
                </label>
                <textarea
                  id="qris_static_payload"
                  name="qris_static_payload"
                  rows={3}
                  placeholder="000201010211..."
                  className="form-textarea"
                />
              </div>
              <button type="submit" className="button button-dark">
                Buka toko sekarang
              </button>
            </form>
          </div>
        </section>
      ) : (
        <>
          <section className="dashboard-section" aria-labelledby="seller-orders-heading">
            <div className="section-heading">
              <p className="eyebrow">PESANAN MASUK (SEBAGAI SELLER)</p>
              <h2 id="seller-orders-heading">Kelola pesanan klien</h2>
            </div>

            {!incomingOrders || incomingOrders.length === 0 ? (
              <div className="empty-state-compact">
                <p>Belum ada pesanan masuk ke tokomu.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nomor Pesanan</th>
                      <th>Status</th>
                      <th>Nominal</th>
                      <th>Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomingOrders.map((ord) => (
                      <tr key={ord.id}>
                        <td>
                          <strong>{ord.order_number}</strong>
                        </td>
                        <td>
                          <span className="status-pill">{ord.status}</span>
                        </td>
                        <td>{formatRupiah(Number(ord.total_idr))}</td>
                        <td>
                          <a href={`/orders/${ord.id}`} className="auth-switch-link">
                            Kelola & verifikasi bayar
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="dashboard-grid-two">
            <div className="auth-card">
              <p className="eyebrow">TAMBAH LAYANAN BARU</p>
              <h2>Terbitkan jasa ke katalog</h2>
              <form action={createServiceAction} className="auth-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="title">
                    Judul layanan jasa
                  </label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    required
                    placeholder="Contoh: Desain Identitas Visual & Logo UMKM"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="category">
                    Kategori
                  </label>
                  <select id="category" name="category" required className="form-input">
                    {SERVICE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="price_idr">
                    Harga paket (IDR)
                  </label>
                  <input
                    id="price_idr"
                    name="price_idr"
                    type="number"
                    min={1000}
                    step={500}
                    required
                    placeholder="150000"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="description">
                    Deskripsi & cakupan pekerjaan
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={4}
                    required
                    placeholder="Rincikan apa saja yang didapat pembeli, jumlah revisi, dan estimasi waktu pengerjaan..."
                    className="form-textarea"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="status">
                    Status publikasi awal
                  </label>
                  <select id="status" name="status" className="form-input">
                    <option value="published">Langsung terbitkan (Published)</option>
                    <option value="draft">Simpan sebagai draf (Draft)</option>
                  </select>
                </div>

                <button type="submit" className="button button-dark button-full">
                  Simpan layanan jasa
                </button>
              </form>
            </div>

            <div className="auth-card">
              <p className="eyebrow">PENGATURAN TOKO & QRIS STATIS</p>
              <h2>Profil toko & pembayaran</h2>
              {qrisCheck?.valid ? (
                <div className="alert alert-success">
                  QRIS aktif terdeteksi: <strong>{qrisCheck.merchantName}</strong> (
                  {qrisCheck.merchantCity ?? "ID"})
                </div>
              ) : null}

              <form action={updateSellerStoreAction} className="auth-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit_store_name">
                    Nama toko
                  </label>
                  <input
                    id="edit_store_name"
                    name="store_name"
                    type="text"
                    required
                    defaultValue={sellerProfile?.store_name ?? ""}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit_store_slug">
                    Slug URL toko
                  </label>
                  <input
                    id="edit_store_slug"
                    name="store_slug"
                    type="text"
                    required
                    pattern="^[a-z0-9-]{3,40}$"
                    defaultValue={sellerProfile?.store_slug ?? ""}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit_bio">
                    Bio toko
                  </label>
                  <textarea
                    id="edit_bio"
                    name="bio"
                    rows={3}
                    defaultValue={sellerProfile?.bio ?? ""}
                    className="form-textarea"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit_qris">
                    Payload QRIS Statis toko
                  </label>
                  <textarea
                    id="edit_qris"
                    name="qris_static_payload"
                    rows={3}
                    defaultValue={sellerProfile?.qris_static_payload ?? ""}
                    placeholder="Tempel string TLV QRIS statis (diawali 000201010211...)"
                    className="form-textarea"
                  />
                  <span className="form-hint">
                    Saat pembeli melakukan checkout, sistem otomatis mengubah payload ini menjadi QRIS Dinamis sesuai nominal pesanan.
                  </span>
                </div>

                <div className="hero-actions">
                  <button type="submit" className="button button-dark">
                    Simpan pengaturan toko
                  </button>
                  <button
                    type="submit"
                    name="use_dummy_qris"
                    value="1"
                    className="button button-light"
                  >
                    Gunakan QRIS contoh (Testing)
                  </button>
                </div>
              </form>
            </div>
          </section>

          <section className="dashboard-section" aria-labelledby="my-services-heading">
            <div className="section-heading">
              <p className="eyebrow">KATALOG TOKO SAYA</p>
              <h2 id="my-services-heading">Daftar layanan yang kamu kelola</h2>
            </div>

            {!myServices || myServices.length === 0 ? (
              <div className="empty-state-compact">
                <p>Tokomu belum memiliki layanan. Gunakan formulir di atas untuk menambahkan jasa pertamamu.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Judul Layanan</th>
                      <th>Kategori</th>
                      <th>Harga</th>
                      <th>Status</th>
                      <th>Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myServices.map((srv) => (
                      <tr key={srv.id}>
                        <td>
                          <a href={`/catalog/${srv.id}`} className="auth-switch-link">
                            {srv.title}
                          </a>
                        </td>
                        <td>{srv.category}</td>
                        <td>{formatRupiah(Number(srv.price_idr))}</td>
                        <td>
                          <span className="status-pill">{srv.status}</span>
                        </td>
                        <td>
                          <form action={toggleServiceStatusAction} className="inline-form">
                            <input type="hidden" name="service_id" value={srv.id} />
                            <input
                              type="hidden"
                              name="next_status"
                              value={srv.status === "published" ? "draft" : "published"}
                            />
                            <button type="submit" className="button button-light button-small">
                              {srv.status === "published" ? "Jadikan Draft" : "Terbitkan"}
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}