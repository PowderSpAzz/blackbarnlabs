-- Notify-me signups. Exactly what the form collects: email, product, time.
CREATE TABLE IF NOT EXISTS notify_signups (
  email   TEXT NOT NULL,
  product TEXT NOT NULL CHECK (product IN ('sentry-turret', 'greenhouse-buddy', 'cat-deterrent')),
  ts      TEXT NOT NULL,
  PRIMARY KEY (email, product)
);
