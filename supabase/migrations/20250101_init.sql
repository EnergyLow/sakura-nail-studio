-- Таблица заявок
CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  service TEXT,
  master TEXT,
  booking_date DATE,
  booking_time TIME,
  comment TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индекс для быстрого поиска новых заявок
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_created_at ON bookings(created_at DESC);

-- Row Level Security (RLS)
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Только сервисная роль (service_role) может читать/писать
-- Публичный доступ запрещён (аноним не должен видеть заявки)
CREATE POLICY "Service role only" ON bookings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);