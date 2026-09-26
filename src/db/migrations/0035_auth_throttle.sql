-- Attempt counters for sign-in, password reset and portal checks, keyed by a hash of the caller's address,
-- so a flood of guesses across many accounts is slowed even though each account has its own lockout.
CREATE TABLE IF NOT EXISTS auth_throttle (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0
);
