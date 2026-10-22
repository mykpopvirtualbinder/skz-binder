import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site-seo";

const FAQ = [
  {
    q: "¿Qué significan las siglas WTS, WTT y OTW?",
    a: "WTS es Want To Sell, para vender. WTT es Want To Trade, para intercambiar. OTW es On The Way, para cartas que ya están de camino.",
  },
  {
    q: "¿Cómo añado una photocard que no está en el catálogo?",
    a: "Con la photocard personalizada subes tu foto y completas los datos. También puedes crear tu propio grupo y, si lo tienes digitalizado, enviarlo para sumarlo al catálogo.",
  },
  {
    q: "¿Puedo comprar e intercambiar photocards?",
    a: "Sí. En el market publicas WTS y WTT y contactas con otros coleccionistas. El envío y el estado de la carta los acuerda quien vende.",
  },
];

export default function SiteJsonLd() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/branding/logo.png`,
        email: "info@mykpopbinder.com",
        description: SITE_DESCRIPTION,
        sameAs: ["https://www.instagram.com/mykpopbinder"],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "es",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#app`,
        name: SITE_NAME,
        url: SITE_URL,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web",
        description: SITE_DESCRIPTION,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "EUR",
        },
        featureList: [
          "Binder digital de photocards",
          "Catálogo de álbumes e inclusiones",
          "Market WTS y WTT",
          "Grupos creados por la comunidad",
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}

export function FaqJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
