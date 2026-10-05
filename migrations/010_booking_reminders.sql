-- Recordatorio por correo la tarde anterior a cada reserva (ver
-- src/lib/bookingReminders.ts y /api/cron/reminders). Marca a qué reservas
-- ya se les mandó, para no mandarlo dos veces si la tarea corre de nuevo.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
