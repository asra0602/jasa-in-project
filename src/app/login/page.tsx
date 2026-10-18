import type { Metadata } from "next";
import { loginAction } from "@/app/(auth)/actions";

export const metadata: Metadata = {
  title: "Masuk | Jasa-in",
  description: "Masuk ke akun Jasa-in untuk memesan jasa atau mengelola tokomu.",
};

interface LoginPageProps {
  searchParams: Promise<{
    error?: string;
    message?: string;
    next?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const errorMessage = params.error;
  const infoMessage = params.message;
  const nextPath = params.next ?? "/dashboard";

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
          <a className="button button-dark button-small" href="/register">
            Daftar akun
          </a>
        </div>
      </nav>

      <section className="auth-section" aria-labelledby="login-heading">
        <div className="auth-grid">
          <div className="auth-intro">
            <p className="eyebrow">AKSES AKUN</p>
            <h1 id="login-heading">Masuk ke ruang kerjamu.</h1>
            <p className="auth-lead">
              Pantau pesanan jasa yang sedang berjalan, kelola katalog tokomu, dan konfirmasi pembayaran QRIS dalam satu tempat.
            </p>
          </div>

          <div className="auth-card">
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

            <form action={loginAction} className="auth-form">
              <input type="hidden" name="next" value={nextPath} />

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
                  autoComplete="current-password"
                  placeholder="Minimal 8 karakter"
                  className="form-input"
                />
              </div>

              <button type="submit" className="button button-dark button-full">
                Masuk sekarang
              </button>
            </form>

            <p className="auth-switch">
              Belum punya akun?{" "}
              <a href="/register" className="auth-switch-link">
                Daftar sebagai pembeli atau seller
              </a>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}