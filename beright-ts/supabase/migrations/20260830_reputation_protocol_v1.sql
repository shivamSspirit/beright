-- Reputation Protocol v1: forward-only identity, evidence, scoring, and passport persistence.
CREATE TABLE IF NOT EXISTS subjects (
  subject_id TEXT PRIMARY KEY, subject_type TEXT NOT NULL CHECK (subject_type IN ('human','agent')),
  primary_solana_wallet TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
  identity_status TEXT NOT NULL CHECK (identity_status IN ('unverified','verified','restricted','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS identity_challenges (
  id UUID PRIMARY KEY, subject_id TEXT NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  primary_wallet TEXT NOT NULL, venue TEXT NOT NULL, external_account TEXT NOT NULL,
  nonce TEXT NOT NULL UNIQUE, domain TEXT NOT NULL, uri TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ,
  protocol_version TEXT NOT NULL CHECK (protocol_version = 'identity-verification/v1'),
  intent TEXT NOT NULL CHECK (intent IN ('link','refresh','revoke')), challenge_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK (expires_at > issued_at)
);

CREATE TABLE IF NOT EXISTS venue_claims (
  claim_id TEXT PRIMARY KEY, subject_id TEXT NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  venue TEXT NOT NULL, venue_account TEXT NOT NULL, proof_type TEXT NOT NULL,
  challenge_hash TEXT NOT NULL, verified_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ,
  verification_version TEXT NOT NULL, metadata_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (venue, venue_account), UNIQUE (subject_id, venue)
);

CREATE TABLE IF NOT EXISTS canonical_events (
  canonical_event_id TEXT PRIMARY KEY, schema_version TEXT NOT NULL, title TEXT NOT NULL, topic TEXT NOT NULL,
  subtopic TEXT NOT NULL, horizon TEXT NOT NULL, outcome_type TEXT NOT NULL, open_time TIMESTAMPTZ NOT NULL,
  close_time TIMESTAMPTZ NOT NULL, resolution_time TIMESTAMPTZ, resolution_source TEXT NOT NULL,
  normalized_rules TEXT NOT NULL, market_rules_hash TEXT NOT NULL, review_status TEXT NOT NULL,
  warnings JSONB NOT NULL DEFAULT '[]', disqualifiers JSONB NOT NULL DEFAULT '[]', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS canonical_market_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), canonical_event_id TEXT NOT NULL REFERENCES canonical_events(canonical_event_id) ON DELETE CASCADE,
  venue TEXT NOT NULL, venue_market_id TEXT NOT NULL, outcome_mapping JSONB NOT NULL, equivalence_score NUMERIC NOT NULL,
  component_scores JSONB NOT NULL, warnings JSONB NOT NULL DEFAULT '[]', disqualifiers JSONB NOT NULL DEFAULT '[]',
  review_state TEXT NOT NULL, reviewer_metadata JSONB NOT NULL DEFAULT '{}', normalized_rule_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (venue, venue_market_id)
);

CREATE TABLE IF NOT EXISTS forecast_receipts (
  receipt_id TEXT PRIMARY KEY, subject_id TEXT NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('trade','explicit_forecast')), venue TEXT NOT NULL, venue_account TEXT NOT NULL,
  venue_market_id TEXT NOT NULL, canonical_event_id TEXT REFERENCES canonical_events(canonical_event_id), predicted_probability NUMERIC NOT NULL,
  direction TEXT NOT NULL, predicted_at TIMESTAMPTZ NOT NULL, entry_price NUMERIC, position_size NUMERIC,
  venue_transaction_reference TEXT, raw_evidence_hash TEXT NOT NULL, ingestion_version TEXT NOT NULL, observed_at TIMESTAMPTZ NOT NULL,
  evidence_finality TEXT NOT NULL, source_checkpoint TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_evidence JSONB NOT NULL, scoring_metadata JSONB NOT NULL DEFAULT '{}',
  UNIQUE (venue, venue_account, venue_market_id, venue_transaction_reference, raw_evidence_hash)
);

CREATE TABLE IF NOT EXISTS resolution_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), canonical_event_id TEXT NOT NULL REFERENCES canonical_events(canonical_event_id),
  venue_market_id TEXT NOT NULL, outcome TEXT NOT NULL, finality TEXT NOT NULL, resolution_source TEXT NOT NULL,
  resolved_at TIMESTAMPTZ NOT NULL, evidence_hash TEXT NOT NULL, dispute_status TEXT NOT NULL, observed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (canonical_event_id, venue_market_id, evidence_hash)
);

CREATE TABLE IF NOT EXISTS topic_score_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), subject_id TEXT NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  topic TEXT NOT NULL, subtopic TEXT NOT NULL, horizon TEXT NOT NULL, score INTEGER NOT NULL, snapshot JSONB NOT NULL,
  scoring_version TEXT NOT NULL, evidence_root TEXT NOT NULL, calculated_at TIMESTAMPTZ NOT NULL,
  data_window_start TIMESTAMPTZ NOT NULL, data_window_end TIMESTAMPTZ NOT NULL,
  UNIQUE (subject_id, topic, subtopic, horizon, scoring_version, calculated_at)
);

CREATE TABLE IF NOT EXISTS underwriting_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), subject_id TEXT NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  recommendation JSONB NOT NULL, policy_version TEXT NOT NULL, passport_root TEXT NOT NULL, calculated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL, policy_inputs JSONB NOT NULL DEFAULT '{}', UNIQUE (subject_id, policy_version, passport_root)
);

CREATE TABLE IF NOT EXISTS passport_epochs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), subject_id TEXT NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  score_epoch BIGINT NOT NULL, passport_root TEXT NOT NULL, evidence_root TEXT NOT NULL, published_signature TEXT,
  cluster TEXT, program_id TEXT, published_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_id, score_epoch), UNIQUE (passport_root)
);

CREATE TABLE IF NOT EXISTS ingestion_checkpoints (
  adapter TEXT NOT NULL, subject_id TEXT NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  venue_account TEXT NOT NULL, checkpoint TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (adapter, subject_id, venue_account)
);

CREATE INDEX IF NOT EXISTS idx_identity_challenges_pending ON identity_challenges(subject_id, expires_at) WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_venue_claims_subject_active ON venue_claims(subject_id, venue) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_receipts_subject_time ON forecast_receipts(subject_id, predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_venue ON forecast_receipts(venue, venue_account);
CREATE INDEX IF NOT EXISTS idx_receipts_event ON forecast_receipts(canonical_event_id);
CREATE INDEX IF NOT EXISTS idx_canonical_events_topic ON canonical_events(topic, subtopic, horizon);
CREATE INDEX IF NOT EXISTS idx_topic_scores_subject ON topic_score_snapshots(subject_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_underwriting_subject ON underwriting_recommendations(subject_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_passport_epochs_subject ON passport_epochs(subject_id, score_epoch DESC);

CREATE OR REPLACE FUNCTION consume_identity_challenge_v1(
  p_challenge_id UUID, p_challenge_hash TEXT, p_claim_id TEXT, p_metadata_hash TEXT,
  p_proof_type TEXT, p_verified_at TIMESTAMPTZ, p_claim_expires_at TIMESTAMPTZ
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE challenge identity_challenges%ROWTYPE;
BEGIN
  SELECT * INTO challenge FROM identity_challenges WHERE id = p_challenge_id FOR UPDATE;
  IF NOT FOUND OR challenge.consumed_at IS NOT NULL OR challenge.expires_at <= now() OR challenge.challenge_hash <> p_challenge_hash THEN RETURN FALSE; END IF;
  UPDATE identity_challenges SET consumed_at = p_verified_at WHERE id = p_challenge_id;
  IF challenge.intent = 'link' THEN
    INSERT INTO venue_claims (claim_id, subject_id, venue, venue_account, proof_type, challenge_hash, verified_at, expires_at, verification_version, metadata_hash)
    VALUES (p_claim_id, challenge.subject_id, challenge.venue, challenge.external_account, p_proof_type, challenge.challenge_hash, p_verified_at, p_claim_expires_at, 'v1', p_metadata_hash)
    ON CONFLICT (subject_id, venue) DO UPDATE SET venue_account = EXCLUDED.venue_account, proof_type = EXCLUDED.proof_type,
      challenge_hash = EXCLUDED.challenge_hash, verified_at = EXCLUDED.verified_at, expires_at = EXCLUDED.expires_at,
      revoked_at = NULL, verification_version = EXCLUDED.verification_version, metadata_hash = EXCLUDED.metadata_hash;
    UPDATE subjects SET identity_status = 'verified', updated_at = p_verified_at WHERE subject_id = challenge.subject_id;
  END IF;
  RETURN TRUE;
END; $$;

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE resolution_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_market_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_score_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE underwriting_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE passport_epochs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public subjects readable" ON subjects FOR SELECT USING (true);
CREATE POLICY "public active claims readable" ON venue_claims FOR SELECT USING (revoked_at IS NULL);
CREATE POLICY "public evidence readable" ON forecast_receipts FOR SELECT USING (true);
CREATE POLICY "public resolutions readable" ON resolution_receipts FOR SELECT USING (true);
CREATE POLICY "public canonical events readable" ON canonical_events FOR SELECT USING (true);
CREATE POLICY "public canonical members readable" ON canonical_market_members FOR SELECT USING (true);
CREATE POLICY "public topic scores readable" ON topic_score_snapshots FOR SELECT USING (true);
CREATE POLICY "public underwriting readable" ON underwriting_recommendations FOR SELECT USING (true);
CREATE POLICY "public passport epochs readable" ON passport_epochs FOR SELECT USING (true);

REVOKE ALL ON identity_challenges FROM anon, authenticated;
REVOKE ALL ON ingestion_checkpoints FROM anon, authenticated;
GRANT SELECT ON subjects, venue_claims, forecast_receipts, resolution_receipts, canonical_events,
  canonical_market_members, topic_score_snapshots, underwriting_recommendations, passport_epochs TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION consume_identity_challenge_v1 TO service_role;

CREATE OR REPLACE VIEW passport_product_metrics AS
SELECT
  (SELECT count(*) FROM subjects WHERE identity_status = 'verified') AS verified_subjects,
  (SELECT count(DISTINCT subject_id) FROM topic_score_snapshots WHERE (snapshot->>'resolvedCount')::INTEGER >= 30) AS subjects_with_30_resolved,
  (SELECT count(*) FROM forecast_receipts) AS total_normalized_receipts,
  (SELECT COALESCE(jsonb_object_agg(venue, receipt_count), '{}'::jsonb) FROM (SELECT venue, count(*) receipt_count FROM forecast_receipts GROUP BY venue) venue_counts) AS receipts_by_venue,
  (SELECT COALESCE(jsonb_object_agg(topic, receipt_count), '{}'::jsonb) FROM (SELECT ce.topic, count(*) receipt_count FROM forecast_receipts fr JOIN canonical_events ce ON ce.canonical_event_id = fr.canonical_event_id GROUP BY ce.topic) topic_counts) AS receipts_by_topic,
  (SELECT count(*) FROM passport_epochs WHERE revoked_at IS NOT NULL) AS revoked_passports,
  (SELECT count(*) FROM underwriting_recommendations) AS underwriting_recommendation_requests;
GRANT SELECT ON passport_product_metrics TO anon, authenticated;

-- Backfill note: existing external_platform_links are intentionally not promoted to verified venue_claims.
-- Owners must complete a fresh v1 challenge so legacy replayable proofs cannot inherit verified status.
