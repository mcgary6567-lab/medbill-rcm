-- Rolling error counts and when each kind of operator alert last went out, so a burst of errors sends one alert, not hundreds.
CREATE TABLE IF NOT EXISTS ops_alerts (
  kind text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 0,
  last_sent_at timestamptz
);
