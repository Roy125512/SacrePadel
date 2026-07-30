// Reception domain types used by /reception UI and its API routes.
export type BookingStatus = "HOLD" | "CONFIRMED" | "CANCELLED" | "NO_SHOW" | "COMPLETED";
export type PaymentStatus = "UNPAID" | "PAID";
export type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "STRIPE" | "MERCADOPAGO";

export type DateMode = "DAY" | "RANGE";

export type Booking = {
  id: string;
  court_id?: string;
  court_name: string;
  start_at: string; // ISO
  end_at: string; // ISO
  status: BookingStatus;
  source?: string;
  kind?: string;

  payment_status?: PaymentStatus;
  paid_amount?: number;
  payment_method?: PaymentMethod | null;
  paid_at?: string | null;

  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;

  created_by_name?: string | null;

  session_type?: "CLASS" | "MATCH" | null;

  duration_hours?: number;
  amount?: number;
};

export type ApiResponse = {
  date?: string | null;
  start?: string | null;
  end?: string | null;
  timezone_offset?: string;
  count: number;
  bookings: Booking[];
  error?: string;
};

export type FilterKey =
  | "fecha"
  | "cancha"
  | "horario"
  | "tipo"
  | "estatus"
  | "pago"
  | "monto"
  | "origen"
  | "registradoPor"
  | "cliente"
  | "asistencia";

export type FiltersState = Record<FilterKey, Set<string>>;
