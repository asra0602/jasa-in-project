import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Katalog Jasa Digital | Jasa-in",
  description: "Jelajahi layanan kreatif, teknis, dan pemasaran dari seller independen di Jasa-in.",
};

export const SERVICE_CATEGORIES = [
  "Desain & Branding",
  "Pengembangan Web & Aplikasi",
  "Penulisan & Terjemahan",
  "Video & Audio",
  "Pemasaran Digital",
] as const;

interface CatalogPageProps {
  searchParams: Promise<{
    category?: string;
    q?: string;
    error?: string;
  }>;
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const selectedCategory = params.category?.trim() ?? "";
  const searchQuery = params.q?.trim() ?? "";
  const errorMessage = params.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("services")
    .select(
      `
      id,
      title,
      slug,
      description,
      category,
      price_idr,
      created_at,
      seller_profiles (
        store_name,
        store_slug,
        qris_enabled
      )
    `
    )
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (selectedCategory) {
    query = query.eq("category", selectedCategory);
  }

  if (searchQuery) {
    query = query.ilike("title", `%${searchQuery}%`);
  }

  const { data: services, error: fetchError } = await query;

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

      <header className="catalog-header">
        <div>
          <p className="eyebrow">KATALOG LAYANAN</p>
          <h1>Pilih jasa dari spesialis independen.</h1>
        </div>
        <form action="/catalog" method="GET" className="catalog-search-form">
          {selectedCategory ? (
            <input type="hidden" name="category" value={selectedCategory} />
          ) : null}
          <label htmlFor="catalog-search" className="sr-only">
            Cari nama jasa
          </label>
          <input
            id="catalog-search"
            name="q"
            type="search"
            defaultValue={searchQuery}
            placeholder="Cari layanan, misalnya desain logo..."
            className="form-input"
          />
          <button type="submit" className="button button-dark button-small">
            Cari
          </button>
        </form>
      </header>

      <nav className="category-bar" aria-label="Filter kategori jasa">
        <a
          href="/catalog"
          className={`category-chip ${!selectedCategory ? "category-chip-active" : ""}`}
        >
          Semua Kategori
        </a>
        {SERVICE_CATEGORIES.map((category) => (
          <a
            key={category}
            href={`/catalog?category=${encodeURIComponent(category)}${
              searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""
            }`}
            className={`category-chip ${
              selectedCategory === category ? "category-chip-active" : ""
            }`}
          >
            {category}
          </a>
        ))}
      </nav>

      {errorMessage || fetchError ? (
        <div className="alert alert-error" role="alert">
          {errorMessage ?? "Gagal memuat daftar katalog jasa. Periksa koneksi database kamu."}
        </div>
      ) : null}

      {!services || services.length === 0 ? (
        <section className="empty-state" aria-live="polite">
          <h2>Belum ada layanan yang sesuai di katalog ini.</h2>
          <p>
            {selectedCategory || searchQuery
              ? "Coba hapus filter kategori atau kata kunci pencarian untuk melihat seluruh layanan yang tersedia."
              : "Jadilah seller pertama yang menerbitkan layanan digital di Jasa-in."}
          </p>
          <div className="empty-state-actions">
            {selectedCategory || searchQuery ? (
              <a href="/catalog" className="button button-light">
                Reset filter katalog
              </a>
            ) : null}
            <a href={user ? "/dashboard" : "/register?role=seller"} className="button button-dark">
              Terbitkan jasa di toko kamu
            </a>
          </div>
        </section>
      ) : (
        <section className="catalog-grid" aria-label="Daftar layanan tersedia">
          {services.map((service) => {
            const seller = Array.isArray(service.seller_profiles)
              ? service.seller_profiles[0]
              : service.seller_profiles;

            return (
              <article key={service.id} className="service-card">
                <div className="service-card-top">
                  <span className="service-category">{service.category}</span>
                  {seller?.qris_enabled ? (
                    <span className="qris-tag">QRIS Dinamis</span>
                  ) : null}
                </div>
                <h2 className="service-card-title">
                  <a href={`/catalog/${service.id}`}>{service.title}</a>
                </h2>
                <p className="service-card-desc">{service.description}</p>
                <div className="service-card-footer">
                  <div>
                    <span className="service-seller-label">Oleh {seller?.store_name ?? "Seller"}</span>
                    <strong className="service-price">
                      {formatRupiah(Number(service.price_idr))}
                    </strong>
                  </div>
                  <a href={`/catalog/${service.id}`} className="button button-dark button-small">
                    Lihat & pesan
                  </a>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}