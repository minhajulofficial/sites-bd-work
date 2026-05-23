import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { faConfig } from "@/lib/fontawesome";
import { AOSProvider } from "@/components/providers/AOSProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartDrawerProvider } from "@/components/cart/CartDrawerProvider";
import { CartProvider } from "@/lib/hooks/useCart";

// Suppress Font Awesome's auto-CSS injection — `@fortawesome/fontawesome-svg-core/styles.css`
// is imported above so the icon sizing works without FOUC.
void faConfig;

const SITE_URL = "https://sites.bd/";
const SITE_NAME = "Sites.bd";
const SITE_TITLE =
  "Web Sites bd | Free Subdomain & Domain Registration & NVMe SSD Web Hosting in Bangladesh";
const SITE_DESCRIPTION =
  "Sites.bd offers affordable domain registration, NVMe SSD web hosting, email hosting, and web design services in Bangladesh. Free SSL, backups, and 24/7 support included.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    "domain registration Bangladesh",
    "cheap web hosting BD",
    "NVMe SSD hosting",
    "buy domain BD",
    "web design Bangladesh",
    "email hosting BD",
  ],
  authors: [{ name: SITE_NAME }],
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
  icons: {
    icon: [{ url: "https://sites.bd/logo.webp", type: "image/webp" }],
    apple: [{ url: "https://sites.bd/logo.webp" }],
  },
  openGraph: {
    title: SITE_TITLE,
    description:
      "Affordable domain names, NVMe SSD hosting, email hosting, and web design services in Bangladesh. Free SSL & 24/7 support.",
    type: "website",
    url: SITE_URL,
    images: ["https://sites.bd/og.webp"],
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: "Sites.bd | Domain Registration & Hosting",
    description:
      "Get affordable domains & NVMe SSD hosting in Bangladesh. Free SSL, backups, and 24/7 support.",
    images: ["https://sites.bd/og.webp"],
    site: "@sitesbd",
  },
  other: {
    language: "en, bn",
    "geo.region": "BD-DH",
    "geo.placename": "Dhaka, Bangladesh",
    "geo.position": "23.8103;90.4125",
    ICBM: "23.8103, 90.4125",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Sites.bd",
  url: "https://sites.bd/",
  description:
    "Sites.bd provides domain registration, NVMe SSD web hosting, email hosting, and web design services in Bangladesh.",
  publisher: {
    "@type": "Organization",
    name: "Sites.bd",
    logo: { "@type": "ImageObject", url: "https://sites.bd/logo.webp" },
  },
  sameAs: [
    "https://www.facebook.com/sitesbd",
    "https://twitter.com/sitesbd",
    "https://www.linkedin.com/company/sitesbd",
  ],
  potentialAction: {
    "@type": "SearchAction",
    target: "https://sites.bd/search?domain={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Sites.bd",
  url: "https://sites.bd/",
  logo: "https://sites.bd/logo.webp",
  contactPoint: [
    {
      "@type": "ContactPoint",
      telephone: "+8801974946747",
      contactType: "customer service",
      areaServed: "BD",
      availableLanguage: ["en", "bn"],
    },
  ],
  sameAs: [
    "https://www.facebook.com/sitesbd",
    "https://twitter.com/sitesbd",
    "https://www.linkedin.com/company/sitesbd",
  ],
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Sites.bd Hosting & Domain Services",
  image: "https://sites.bd/og.webp",
  url: "https://sites.bd/",
  telephone: "+8801974946747",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Dhaka",
    addressLocality: "Dhaka",
    addressRegion: "Dhaka Division",
    postalCode: "1207",
    addressCountry: "BD",
  },
  priceRange: "৳৳",
  openingHours: "Mo-Su 09:00-22:00",
  geo: {
    "@type": "GeoCoordinates",
    latitude: "23.8103",
    longitude: "90.4125",
  },
};

const hostingServiceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "Web Hosting",
  provider: {
    "@type": "Organization",
    name: "Sites.bd",
    url: "https://sites.bd/",
  },
  areaServed: { "@type": "Country", name: "Bangladesh" },
  offers: {
    "@type": "Offer",
    url: "https://sites.bd/hosting",
    priceCurrency: "BDT",
    price: "1350",
    priceValidUntil: "2026-12-31",
    availability: "https://schema.org/InStock",
  },
};

const domainServiceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "Domain Registration",
  provider: {
    "@type": "Organization",
    name: "Sites.bd",
    url: "https://sites.bd/",
  },
  offers: {
    "@type": "Offer",
    url: "https://sites.bd/domain",
    priceCurrency: "BDT",
    price: "1349",
    priceValidUntil: "2026-12-31",
    availability: "https://schema.org/InStock",
  },
};

const emailServiceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "Email Hosting",
  provider: {
    "@type": "Organization",
    name: "Sites.bd",
    url: "https://sites.bd/",
  },
  areaServed: { "@type": "Country", name: "Bangladesh" },
};

const faqShortJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Does Sites.bd provide free SSL?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, Sites.bd provides free SSL certificates for life with all hosting plans.",
      },
    },
    {
      "@type": "Question",
      name: "What is the uptime guarantee?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sites.bd guarantees 99.9% uptime with NVMe SSD hosting.",
      },
    },
    {
      "@type": "Question",
      name: "Can I migrate my website to Sites.bd?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, Sites.bd offers free website migration with all hosting packages.",
      },
    },
  ],
};

const faqLongJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Does Sites.bd provide free SSL certificates?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, Sites.bd provides free SSL certificates for life with all hosting plans, ensuring secure browsing and better SEO rankings.",
      },
    },
    {
      "@type": "Question",
      name: "What is NVMe SSD hosting and why is it faster?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "NVMe SSD hosting uses next-generation solid-state drives with ultra-fast read/write speeds, making websites load significantly faster compared to traditional HDD or SATA SSD hosting.",
      },
    },
    {
      "@type": "Question",
      name: "Can I host AI or LLM applications on Sites.bd servers?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, Sites.bd hosting supports modern frameworks and APIs, making it possible to deploy AI-driven applications, chatbots, and LLM-based services with optimized performance.",
      },
    },
    {
      "@type": "Question",
      name: "Does Sites.bd offer website migration?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, Sites.bd offers free website migration services, ensuring a smooth transfer of your existing site to our hosting platform without downtime.",
      },
    },
    {
      "@type": "Question",
      name: "What domain extensions are available at Sites.bd?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sites.bd offers popular domain extensions including .com, .net, .org, .xyz, and .biz at affordable prices, with easy registration and renewal options.",
      },
    },
    {
      "@type": "Question",
      name: "Does Sites.bd provide email hosting for businesses?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, Sites.bd provides professional email hosting with unlimited accounts, secure servers, and spam protection for businesses of all sizes.",
      },
    },
    {
      "@type": "Question",
      name: "What is the uptime guarantee of Sites.bd hosting?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sites.bd guarantees 99.9% uptime with NVMe SSD hosting, ensuring your website remains accessible and reliable at all times.",
      },
    },
    {
      "@type": "Question",
      name: "Does Sites.bd support WordPress and other CMS?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, Sites.bd supports WordPress, Joomla, Drupal, and other CMS platforms with one-click installation via Softaculous Apps Installer.",
      },
    },
    {
      "@type": "Question",
      name: "Can Sites.bd hosting be used for machine learning projects?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, Sites.bd hosting can be configured to support machine learning projects, APIs, and lightweight AI workloads, making it suitable for developers experimenting with LLMs and AI applications.",
      },
    },
    {
      "@type": "Question",
      name: "Does Sites.bd provide customer support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, Sites.bd provides 24/7 human support via chat, email, and phone to assist with technical issues, billing, and service management.",
      },
    },
  ],
};

const aiHostingJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "AI & LLM Hosting",
  provider: {
    "@type": "Organization",
    name: "Sites.bd",
    url: "https://sites.bd/",
  },
  areaServed: { "@type": "Country", name: "Bangladesh" },
  offers: {
    "@type": "Offer",
    url: "https://sites.bd/ai-hosting",
    priceCurrency: "BDT",
    price: "2500",
    availability: "https://schema.org/InStock",
  },
};

const reviewJsonLd = {
  "@context": "https://schema.org",
  "@type": "Review",
  itemReviewed: { "@type": "Service", name: "NVMe SSD Hosting" },
  author: { "@type": "Person", name: "Verified Customer" },
  reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
  reviewBody:
    "Sites.bd hosting is fast, secure, and reliable. Free SSL and 24/7 support make it the best choice in Bangladesh.",
};

const ALL_JSON_LD = [
  websiteJsonLd,
  organizationJsonLd,
  localBusinessJsonLd,
  hostingServiceJsonLd,
  domainServiceJsonLd,
  emailServiceJsonLd,
  faqShortJsonLd,
  faqLongJsonLd,
  aiHostingJsonLd,
  reviewJsonLd,
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* AOS animations stylesheet — kept on the CDN to preserve the legacy
            visual behavior exactly. The library JS is wired via AOSProvider. */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/aos@2.3.1/dist/aos.css"
        />
        {ALL_JSON_LD.map((item, i) => (
          <script
            key={`ld-${i}`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
          />
        ))}
      </head>
      <body className="font-sans overflow-x-hidden bg-gray-50">
        <CartProvider>
          <CartDrawerProvider>
            <AOSProvider>{children}</AOSProvider>
            <CartDrawer />
          </CartDrawerProvider>
        </CartProvider>
        <Script
          src="https://cdn.counter.dev/script.js"
          data-id="1d4d7e40-e2f7-4bc8-91e2-56cca32e3838"
          data-utcoffset="6"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
