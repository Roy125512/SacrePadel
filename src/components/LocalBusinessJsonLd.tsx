import { SITE } from "@/lib/site";

// Ficha estructurada del club para Google (dirección, mapa, horario,
// teléfono). Es solo datos (JSON), no se ejecuta; se escapa "<" para que el
// contenido nunca pueda cerrar la etiqueta <script>.
export default function LocalBusinessJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: SITE.name,
    description: SITE.description,
    url: `${SITE.url}/inicio`,
    image: `${SITE.url}/opengraph-image.jpg`,
    telephone: SITE.phone,
    email: SITE.email,
    sameAs: [SITE.instagram],
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE.address.street,
      addressLocality: SITE.address.city,
      addressRegion: SITE.address.region,
      postalCode: SITE.address.postalCode,
      addressCountry: SITE.address.country,
    },
    geo: { "@type": "GeoCoordinates", latitude: SITE.geo.lat, longitude: SITE.geo.lng },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: SITE.hours.opens,
        closes: SITE.hours.closes,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
