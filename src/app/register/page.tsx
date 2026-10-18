import type { Metadata } from "next";
import { registerAction } from "@/app/(auth)/actions";

export const metadata: Metadata = {
  title: "Daftar Akun | Jasa-in",
  description: "Buat akun Jasa-in sebagai pembeli atau langsung buka toko jasa digitalmu.",
};

interface RegisterPageProps {
  searchParams: Promise<{
    error?: string;
    role?: string;
  }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const errorMessage = params.error;
  const initialRole = params.role === "seller" ? "seller" : "buyer";

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
          <a className="nav-link" href="/login">
            Masuk
          </a>
        </div>
      </nav>

      <section className="auth-section" aria-labelledby="register-heading">
        <div className="auth-grid">
          <div className="auth-intro">
            <p className="eyebrow">PENDAFTARAN AKUN</p>
            <h1 id="register-heading">Mulai transaksi atau buka toko jasa.</h1>
            <p className="auth-lead">
              Kamu bisa mendaftar sebagai pembeli terlebih dahulu, atau langsung memilih opsi seller untuk menyiapkan profil toko dan menerima pembayaran QRIS.
            </p>
            <div className="role-Comparison">
              <div className="role-note-item">
                <strong>Akun Pembeli</strong>
                <p>Pesan layanan digital dari berbagai seller dan bisa upgrade ke seller kapan saja lewat dashboard.</p>
              </div>
              <div className="role-note-item">
                <strong>Akun Seller</strong>
                <p>Langsung klaim slug toko unikmu, terbitkan katalog jasa, dan pasang payload QRIS untuk pembayaran otomatis per nominal.</p>
              </div>
            </div>
          </div>

          <div className="auth-card">
            {errorMessage ? (
              <div className="alert alert-error" role="alert">
                {errorMessage}
              </div>
            ) : null}

            <form action={registerAction} className="auth-form">
              <fieldset className="role-fieldset">
                <legend className="form-label">Tujuan pendaftaran awal</legend>
                <div className="role-options">
                  <label className="role-option">
                    <input
                      type="radio"
                      name="account_mode"
                      value="buyer"
                      defaultChecked={initialRole === "buyer"}
                    />
                    <span>
                      <strong>Pembeli</strong>
                      <small>Cari dan pesan jasa</small>
                    </span>
                  </label>
                  <label className="role-option">
                    <input
                      type="radio"
                      name="account_mode"
                      value="seller"
                      defaultChecked={initialRole === "seller"}
                    />
                    <span>
                      <strong>Seller</strong>
                      <small>Buka toko dan jual jasa</small>
                    </span>
                  </label>
                </div>
              </fieldset>

              <div className="form-group">
                <label className="form-label" htmlFor="display_name">
                  Nama tampilan
                </label>
                <input
                  id="display_name"
                  name="display_name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Nama lengkap atau panggilan"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  pattern="^[a-z0-9_]{3,30}$"
                  placeholder="contoh: asra_kreatif"
                  className="form-input"
                />
                <span className="form-hint">
                  3-30 karakter: huruf kecil, angka, atau garis bawah (_).
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="email">
                  Alamat email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="nama@email.com"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">
                  Kata sandi
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Minimal 8 karakter"
                  className="form-input"
                />
              </div>

              <div className="seller-fields-box">
                <p className="seller-fields-title">
                  Detail Toko (Wajib diisi jika memilih Seller)
                </p>

                <div className="form-group">
                  <label className="form-label" htmlFor="store_name">
                    Nama toko
                  </label>
                  <input
                    id="store_name"
                    name="store_name"
                    type="text"
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
                    pattern="^[a-z0-9-]{3,40}$"
                    placeholder="contoh: studio-kayuh-digital"
                    className="form-input"
                  />
                  <span className="form-hint">
                    3-40 karakter: huruf kecil, angka, atau tanda hubung (-).
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="store_bio">
                    Deskripsi singkat toko (opsional)
                  </label>
                  <textarea
                    id="store_bio"
                    name="store_bio"
                    rows={3}
                    placeholder="Jelaskan keahlian utama dan jenis layanan yang kamu tawarkan..."
                    className="form-textarea"
                  />
                </div>
              </div>

              <button type="submit" className="button button-dark button-full">
                Buat akun Jasa-in
              </button>
            </form>

            <p className="auth-switch">
              Sudah punya akun?{" "}
              <a href="/login" className="auth-switch-link">
                Masuk di sini
              </a>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}