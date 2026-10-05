// Datos públicos del club, en un solo lugar (SEO, ficha para Google, etc.).
export const SITE = {
  name: "Sacré Pádel",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://sacrepadel.com",
  description:
    "Club de pádel en Pátzcuaro, Michoacán. Reserva tu cancha en línea en segundos, paga en línea o en recepción.",
  phone: "+52 1 434 116 8095",
  whatsapp: "5214341168095",
  email: "sacrepadelpatz@gmail.com",
  instagram: "https://instagram.com/sacrepadel.patz",
  address: {
    street: "C. Narciso Servín 100, Santo Tomas",
    city: "Pátzcuaro",
    region: "Michoacán",
    postalCode: "61607",
    country: "MX",
  },
  geo: { lat: 19.521693, lng: -101.617116 },
  hours: { opens: "07:00", closes: "22:00" },
};
