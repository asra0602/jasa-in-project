const plannedFeatures = [
  { number: "01", title: "Katalog jasa", description: "Temukan layanan kreatif dan digital dari berbagai seller." },
  { number: "02", title: "Dashboard seller", description: "Kelola jasa, harga, dan pesanan dalam satu tempat." },
  { number: "03", title: "Pembayaran per seller", description: "Rancangan awal pembayaran menggunakan QRIS milik seller." },
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <nav className="nav" aria-label="Navigasi utama">
        <a className="brand" href="/" aria-label="Jasa-in beranda">jasa<span>-</span>in</a>
        <div className="nav-actions">
          <a className="nav-link" href="/login">Masuk</a>
          <a className="button button-dark button-small" href="/register">Mulai berjualan <span aria-hidden="true">↗</span></a>
        </div>
      </nav>

      <section className="hero">

        <h1>Keahlianmu.<br /><span>Jadi peluang.</span></h1>
        <p className="hero-copy">Temukan jasa yang kamu butuhkan, atau mulai tawarkan keahlianmu kepada lebih banyak orang.</p>
        <div className="hero-actions">
          <a className="button button-dark" href="/catalog">Jelajahi jasa <span aria-hidden="true">→</span></a>
          <a className="button button-light" href="/register">Jadi seller</a>
        </div>
        <div className="hero-note"><span className="note-line" /> Platform jasa digital yang dibangun untuk transaksi lebih jelas dan terarah.</div>
      </section>

      <section className="features" aria-labelledby="features-title">
        <div className="section-heading">
          <p className="eyebrow">DIBANGUN UNTUK KERJA NYATA</p>
          <h2 id="features-title">Semua proses, lebih teratur.</h2>
        </div>
        <div className="feature-grid">
          {plannedFeatures.map((feature) => (
            <article className="feature-card" key={feature.number}>
              <span className="feature-number">{feature.number}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      import SaweriaLeaderboard from "@/components/SaweriaLeaderboard";
      
      <footer className="footer">
        <a className="brand brand-footer" href="/">jasa<span>-</span>in</a>
        <p>Tempat keahlian menemukan kebutuhan.</p>
        <span>© {new Date().getFullYear()} Jasa-in</span>
      </footer>
    </main>
  );
}
