"use client";

import Link from 'next/link';
import { useGlobal } from "./context/GlobalContext";

export default function NotFound() {
  const { t } = useGlobal();

  return (
    <main style={{
      minHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-main)',
      color: 'var(--text-main)',
      padding: '2rem',
      textAlign: 'center',
      transition: "background-color 0.3s ease"
    }}>
      <h1 className="tan-font" style={{ 
        fontSize: '6rem', 
        fontWeight: 900, 
        color: 'var(--color-primary)',
        margin: 0,
        lineHeight: 1
      }}>
        {t("not_found.title")}
      </h1>
      
      <h2 style={{ 
        fontSize: '1.8rem', 
        marginBottom: '1rem',
        fontWeight: 800,
        color: 'var(--text-main)'
      }}>
        {t("not_found.subtitle")}
      </h2>
      
      <p style={{ 
        marginBottom: '2.5rem', 
        color: 'var(--text-muted)',
        maxWidth: '400px',
        fontWeight: 600,
        lineHeight: 1.6
      }}>
        {t("not_found.description")}
      </p>
      
      <Link href="/" style={{
        background: 'var(--color-primary)',
        color: 'white',
        padding: '1rem 2.5rem',
        borderRadius: '99px',
        textDecoration: 'none',
        fontWeight: 900,
        fontSize: '0.9rem',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        boxShadow: '0 10px 20px var(--shadow-card)',
        transition: 'transform 0.2s ease'
      }}
      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        {t("not_found.btn_back")}
      </Link>

      <style jsx global>{`
        @font-face { font-family: 'TanTangkiwood'; src: url('/fonts/tan-tangkiwood-regular.otf') format('opentype'); }
        .tan-font { font-family: 'TanTangkiwood', sans-serif !important; }
      `}</style>
    </main>
  );
}