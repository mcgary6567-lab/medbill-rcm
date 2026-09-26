-- Clearinghouse enrollment per payer and transaction (claims, ERA, EFT, eligibility, claim status).
CREATE TABLE IF NOT EXISTS transaction_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES practices(id),
  payer_id uuid NOT NULL REFERENCES payers(id),
  transaction text NOT NULL,
  status text NOT NULL DEFAULT 'not_started',
  submitted_on date,
  approved_on date,
  reference text,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (practice_id, payer_id, transaction)
);

-- SMART backend services (signed-JWT client credentials) for FHIR.
ALTER TABLE fhir_connections ADD COLUMN IF NOT EXISTS auth_mode text NOT NULL DEFAULT 'token';
ALTER TABLE fhir_connections ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE fhir_connections ADD COLUMN IF NOT EXISTS token_url text;
ALTER TABLE fhir_connections ADD COLUMN IF NOT EXISTS scope text;
ALTER TABLE fhir_connections ADD COLUMN IF NOT EXISTS key_id text;
ALTER TABLE fhir_connections ADD COLUMN IF NOT EXISTS private_key_sealed text;
ALTER TABLE fhir_connections ADD COLUMN IF NOT EXISTS public_jwk jsonb;

-- Statements printed and mailed through Lob.
ALTER TABLE statements ADD COLUMN IF NOT EXISTS mail_id text;
ALTER TABLE statements ADD COLUMN IF NOT EXISTS mail_status text;
ALTER TABLE statements ADD COLUMN IF NOT EXISTS mailed_at timestamptz;

-- Card-present payments on a Stripe Terminal reader.
CREATE TABLE IF NOT EXISTS terminal_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES practices(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  reader_id text NOT NULL,
  payment_intent_id text NOT NULL UNIQUE,
  amount_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'waiting',
  failure text,
  ledger_entry_id uuid,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS terminal_payments_practice_idx ON terminal_payments (practice_id, created_at);

-- Contract terms beyond a flat rate: multiple-procedure and modifier reductions.
ALTER TABLE fee_schedules ADD COLUMN IF NOT EXISTS rules jsonb;
ALTER TABLE fee_schedule_items ADD COLUMN IF NOT EXISTS mppr boolean NOT NULL DEFAULT false;

-- Service locations (clinics, facilities) for practices that see patients in more than one place.
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES practices(id),
  name text NOT NULL,
  npi text,
  address1 text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  zip text NOT NULL,
  place_of_service text NOT NULL DEFAULT '11',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS locations_practice_idx ON locations (practice_id);
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id);
