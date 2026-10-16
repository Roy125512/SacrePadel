import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description: "Cómo trata Sacré Pádel tus datos personales: qué datos pedimos, para qué, con quién se comparten y cómo ejercer tus derechos ARCO.",
};

const ADDRESS = `${SITE.address.street}, C.P. ${SITE.address.postalCode}, ${SITE.address.city}, ${SITE.address.region}, México`;

/** Aviso de privacidad integral (Ley Federal de Protección de Datos Personales en Posesión de los Particulares). */
export default function PrivacidadPage() {
  return (
    <LegalPage kicker="Legal" title="Aviso de privacidad">
      <h2>1. Quién es responsable de tus datos</h2>
      <p>
        {SITE.name} (en adelante, “el Club”), con domicilio en {ADDRESS}, es responsable del tratamiento de los datos
        personales que nos das al usar {SITE.url.replace(/^https?:\/\//, "")} y nuestros servicios. Para cualquier tema
        de privacidad escríbenos a <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
      </p>

      <h2>2. Qué datos recabamos</h2>
      <ul>
        <li>
          <b>Identificación y contacto:</b> nombre, correo electrónico y teléfono.
        </li>
        <li>
          <b>Perfil de juego:</b> fecha de nacimiento, sexo, categoría o nivel de juego, resultados de partidos
          competitivos y tu historial de nivel.
        </li>
        <li>
          <b>Uso del servicio:</b> reservas, partidos, inscripciones a torneos y clases, renta de palas, avisos de horarios
          que pediste y saldos pendientes.
        </li>
        <li>
          <b>Pagos:</b> montos, fecha, estado y número de operación de Mercado Pago. <b>No recibimos ni guardamos</b> los
          datos de tu tarjeta o cuenta bancaria; los captura y procesa directamente Mercado Pago.
        </li>
        <li>
          <b>Datos técnicos:</b> dirección IP, navegador y registros de acceso que generan nuestros servidores por seguridad.
        </li>
      </ul>
      <p>No te pedimos datos personales sensibles.</p>

      <h2>3. Para qué los usamos</h2>
      <p>Finalidades necesarias para darte el servicio:</p>
      <ol>
        <li>Crear y administrar tu cuenta e identificarte al iniciar sesión.</li>
        <li>Apartar canchas, clases y lugares en partidos o torneos, y confirmarlos en recepción.</li>
        <li>Cobrar, dividir pagos entre jugadores, emitir reembolsos y llevar el control de saldos pendientes.</li>
        <li>Enviarte correos de servicio: confirmaciones, recordatorios, cancelaciones, ligas de pago y avisos que pediste.</li>
        <li>Calcular tu nivel y armar partidos parejos según nivel y categoría (varonil, femenil o mixta).</li>
        <li>Mostrar el ranking del club, los jugadores de un partido abierto y las parejas de un torneo.</li>
        <li>Atender dudas, aclaraciones y quejas, y prevenir abusos o fraudes.</li>
        <li>Cumplir obligaciones legales y fiscales.</li>
      </ol>
      <p>
        Hoy <b>no usamos tus datos para publicidad ni los vendemos</b>. Si algún día quisiéramos mandarte promociones, te
        pediremos permiso antes y podrás negarte sin que eso afecte tu cuenta.
      </p>

      <h2>4. Qué se ve públicamente</h2>
      <p>
        En el ranking, los partidos abiertos y los torneos solo mostramos tu nombre corto (nombre y la inicial del apellido)
        y tu nivel. Puedes dejar de aparecer en el ranking cuando quieras desde{" "}
        <Link href="/perfil#nivel">tu perfil</Link>. Tu correo, teléfono y fecha de nacimiento nunca se muestran a otros
        jugadores.
      </p>

      <h2>5. Con quién compartimos tus datos</h2>
      <p>Solo con los proveedores que necesitamos para operar, que los tratan por cuenta nuestra y bajo nuestras instrucciones:</p>
      <ul>
        <li>
          <b>Mercado Pago</b>, para procesar pagos y reembolsos.
        </li>
        <li>
          <b>Supabase</b> (base de datos e inicio de sesión) y <b>Vercel</b> (alojamiento del sitio). Sus servidores pueden
          estar fuera de México.
        </li>
        <li>
          <b>Nuestro proveedor de correo</b>, para enviarte los correos del servicio.
        </li>
      </ul>
      <p>
        Además, podemos entregar datos a autoridades cuando una ley u orden competente lo exija. Fuera de estos casos no
        transferimos tus datos a terceros sin tu consentimiento.
      </p>

      <h2>6. Cookies y almacenamiento</h2>
      <p>
        Usamos cookies estrictamente necesarias para mantener tu sesión iniciada. No usamos cookies de publicidad ni de
        analítica. El mapa de ubicación es de Google Maps, que puede usar sus propias cookies según su política de
        privacidad.
      </p>

      <h2>7. Tus derechos ARCO y cómo retirar tu consentimiento</h2>
      <p>
        Tienes derecho a <b>A</b>cceder a tus datos, <b>R</b>ectificarlos, <b>C</b>ancelarlos u <b>O</b>ponerte a su uso,
        así como a revocar tu consentimiento. Muchos datos los puedes corregir tú mismo en{" "}
        <Link href="/perfil">tu perfil</Link>. Para todo lo demás, incluido borrar tu cuenta, manda un correo a{" "}
        <a href={`mailto:${SITE.email}`}>{SITE.email}</a> con:
      </p>
      <ul>
        <li>tu nombre y el correo con el que te registraste;</li>
        <li>una identificación oficial (o la de tu representante y el documento que lo acredite);</li>
        <li>qué derecho quieres ejercer y sobre qué datos.</li>
      </ul>
      <p>
        Te respondemos en un máximo de 20 días hábiles y, si procede, lo aplicamos dentro de los 15 días hábiles siguientes.
        Al borrar tu cuenta conservaremos solo lo que la ley nos obligue a guardar (por ejemplo, registros de pagos) y por el
        tiempo que nos obligue.
      </p>

      <h2>8. Cuánto tiempo los guardamos</h2>
      <p>
        Mientras tengas cuenta con nosotros. Después los bloqueamos y los borramos al terminar los plazos legales que
        apliquen.
      </p>

      <h2>9. Menores de edad</h2>
      <p>
        Para crear una cuenta debes ser mayor de edad. Las reservas o clases para menores las hace su madre, padre o tutor
        desde su propia cuenta.
      </p>

      <h2>10. Cambios a este aviso</h2>
      <p>
        Si cambiamos este aviso, publicaremos la versión nueva en esta página con su fecha de actualización y, si el cambio
        es importante, te avisaremos por correo.
      </p>
      <p>
        Si consideras que tus derechos no fueron atendidos, puedes acudir a la autoridad de protección de datos personales
        competente en México.
      </p>
    </LegalPage>
  );
}
