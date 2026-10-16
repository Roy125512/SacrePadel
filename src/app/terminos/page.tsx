import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { SITE } from "@/lib/site";
import { CANCEL_NOTICE_HOURS, CLOSE_HOUR, MAX_BOOKING_MINUTES, OPEN_HOUR, SPLIT_DEBT_GRACE_HOURS } from "@/lib/config";
import { MAX_PADDLE_RENTALS, PADDLE_RENTAL_PRICE } from "@/lib/pricing-shared";
import { RESULT_WINDOW_DAYS } from "@/lib/levels-shared";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Reglas de reservas, pagos, cancelaciones y reembolsos de Sacré Pádel, Pátzcuaro.",
};

const H = CANCEL_NOTICE_HOURS;

/** Términos y condiciones de uso del sitio y de los servicios del club. */
export default function TerminosPage() {
  return (
    <LegalPage kicker="Legal" title="Términos y condiciones">
      <p>
        Estos términos aplican al uso de {SITE.url.replace(/^https?:\/\//, "")} y a los servicios de {SITE.name} (“el
        Club”), {SITE.address.street}, {SITE.address.city}, {SITE.address.region}. Al crear una cuenta, reservar o pagar,
        los aceptas. Tus datos se tratan conforme a nuestro <Link href="/privacidad">Aviso de privacidad</Link>.
      </p>

      <h2>1. Cuenta</h2>
      <ul>
        <li>Debes ser mayor de edad y dar datos verdaderos. Tu cuenta es personal y eres responsable de lo que se haga con ella.</li>
        <li>
          El Club puede suspender cuentas que reserven sin presentarse de forma repetida, dejen pagos pendientes, registren
          resultados falsos o hagan mal uso del sitio.
        </li>
      </ul>

      <h2>2. Reservas</h2>
      <ul>
        <li>
          Las canchas se reservan de {String(OPEN_HOUR).padStart(2, "0")}:00 a {CLOSE_HOUR}:00, por bloques de 1 a{" "}
          {MAX_BOOKING_MINUTES / 60} horas. La reserva queda confirmada cuando el sitio te lo indica y te llega el correo.
        </li>
        <li>El tiempo empieza y termina a la hora reservada aunque llegues tarde, para no afectar a quien sigue.</li>
        <li>
          El precio es el que ves al reservar. Las tarifas (incluidas las de horas valle) pueden cambiar, pero una reserva ya
          hecha conserva su precio.
        </li>
      </ul>

      <h2>3. Pagos</h2>
      <ul>
        <li>
          Puedes pagar en línea con Mercado Pago o, cuando se ofrece, en recepción al llegar. Los pagos en línea los procesa
          Mercado Pago; el Club no recibe los datos de tu tarjeta.
        </li>
        <li>Los precios están en pesos mexicanos.</li>
      </ul>

      <h2>4. Cancelaciones y reembolsos</h2>
      <ul>
        <li>
          Puedes cancelar tú mismo, desde tu perfil o la liga del correo, <b>hasta {H} horas antes</b> del inicio. Si pagaste
          en línea, te devolvemos el pago completo en automático por Mercado Pago.
        </li>
        <li>
          Con menos de {H} horas ya no se puede cancelar en línea y <b>no hay reembolso</b>. Los casos especiales (lluvia,
          fuerza mayor) los resuelve recepción.
        </li>
        <li>
          Si el Club cancela una reserva, clase o torneo (mantenimiento, clima u otra causa), te devolvemos lo pagado
          completo.
        </li>
        <li>Lo pagado en recepción se reembolsa directamente en recepción.</li>
        <li>
          El dinero vuelve al mismo medio con el que pagaste. El tiempo en que se refleja depende de Mercado Pago y de tu
          banco.
        </li>
      </ul>

      <h2>5. Pago dividido</h2>
      <ul>
        <li>
          Quien reserva puede dividir el pago entre 2, 3 o 4. Paga su parte para confirmar la cancha y comparte una liga
          para que los demás paguen la suya.
        </li>
        <li>
          <b>Quien reserva responde por el total.</b> Lo que no se haya pagado {SPLIT_DEBT_GRACE_HOURS} horas después de
          terminado el partido queda como saldo pendiente a su cargo, y no podrá hacer nuevas reservas hasta cubrirlo.
        </li>
        <li>Si la reserva se cancela a tiempo, a cada quien se le devuelve lo que pagó.</li>
      </ul>

      <h2>6. Partidos abiertos</h2>
      <ul>
        <li>
          Para unirte necesitas cuenta, cumplir el nivel y la categoría del partido y pagar tu lugar. Puedes salirte hasta{" "}
          {H} horas antes y se te devuelve tu pago; después ya no.
        </li>
        <li>Los lugares que nadie ocupe siguen la regla del pago dividido: quedan a cargo de quien creó el partido.</li>
      </ul>

      <h2>7. Nivel y ranking</h2>
      <ul>
        <li>
          El nivel (0 a 7) es orientativo: sirve para armar partidos parejos. Se ajusta solo con partidos competitivos cuyo
          resultado se registre y confirme dentro de los {RESULT_WINDOW_DAYS} días siguientes.
        </li>
        <li>Registrar resultados falsos es motivo de suspensión. El Club puede corregir resultados o niveles con errores.</li>
      </ul>

      <h2>8. Torneos, americanas y clínicas</h2>
      <ul>
        <li>Tu lugar queda apartado al pagar la inscripción (o al inscribirte, si es gratis).</li>
        <li>
          Puedes cancelar tu inscripción hasta {H} horas antes con reembolso. Si el Club cancela el evento, se reembolsa a
          todos.
        </li>
        <li>El formato, horario y reglas de cada evento se publican en su página; los resultados los captura el Club.</li>
      </ul>

      <h2>9. Clases</h2>
      <p>
        Las clases con entrenador se rigen por las mismas reglas de pago y cancelación que una reserva: puedes cancelar
        hasta {H} horas antes con reembolso. El precio incluye la cancha.
      </p>

      <h2>10. Renta de palas</h2>
      <p>
        Puedes rentar hasta {MAX_PADDLE_RENTALS} palas por reserva a ${PADDLE_RENTAL_PRICE} cada una. Se recogen y devuelven
        en recepción y debes regresarlas en el estado en que las recibiste.
      </p>

      <h2>11. Uso de las instalaciones</h2>
      <ul>
        <li>Respeta al personal, a los demás jugadores y las indicaciones del Club.</li>
        <li>Usa calzado adecuado para pádel y cuida las canchas.</li>
        <li>
          El pádel es una actividad física con riesgo de lesiones. Juegas bajo tu propia responsabilidad y debes estar en
          condiciones de salud para hacerlo. El Club no responde por objetos personales olvidados o perdidos.
        </li>
      </ul>

      <h2>12. Cambios y contacto</h2>
      <p>
        El Club puede actualizar estos términos; la versión vigente es la publicada en esta página y no afecta reservas ya
        pagadas. Dudas, aclaraciones o quejas: <a href={`mailto:${SITE.email}`}>{SITE.email}</a> o{" "}
        <a href={`https://wa.me/${SITE.whatsapp}`}>WhatsApp {SITE.phone}</a>.
      </p>
      <p>
        Estos términos se rigen por las leyes de México. Para cualquier controversia, las partes se someten a los tribunales
        de {SITE.address.city}, {SITE.address.region}, sin perjuicio de tus derechos ante la Procuraduría Federal del
        Consumidor (Profeco).
      </p>
    </LegalPage>
  );
}
