-- Polymarket-only Passport publisher. A public address creates an unclaimed subject;
-- wallet ownership remains unverified until a separate signature claim is completed.
ALTER TABLE subjects ALTER COLUMN primary_solana_wallet DROP NOT NULL;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS primary_wallet TEXT;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS primary_wallet_chain TEXT CHECK (primary_wallet_chain IN ('ethereum','solana'));
UPDATE subjects SET primary_wallet = primary_solana_wallet, primary_wallet_chain = 'solana' WHERE primary_wallet IS NULL AND primary_solana_wallet IS NOT NULL;
ALTER TABLE subjects ALTER COLUMN primary_wallet SET NOT NULL;
ALTER TABLE subjects ALTER COLUMN primary_wallet_chain SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_primary_wallet_lower ON subjects(lower(primary_wallet));

CREATE TABLE IF NOT EXISTS passport_bundles (
  subject_id TEXT PRIMARY KEY REFERENCES subjects(subject_id) ON DELETE CASCADE,
  passport_root TEXT NOT NULL UNIQUE,
  evidence_root TEXT NOT NULL,
  bundle JSONB NOT NULL,
  report JSONB NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS passport_worker_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id TEXT NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  venue TEXT NOT NULL CHECK (venue = 'polymarket'),
  venue_account TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('complete','failed')),
  report JSONB NOT NULL DEFAULT '{}',
  error_code TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_passport_worker_runs_subject ON passport_worker_runs(subject_id, finished_at DESC);

ALTER TABLE passport_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE passport_worker_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON passport_bundles, passport_worker_runs FROM anon, authenticated;
GRANT ALL ON passport_bundles, passport_worker_runs TO service_role;

-- Raw provider payloads are available only through the Passport
-- evidence-bundle API. Do not expose source_evidence through Supabase REST.
DROP POLICY IF EXISTS "public evidence readable" ON forecast_receipts;
REVOKE SELECT ON forecast_receipts, underwriting_recommendations FROM anon, authenticated;

CREATE OR REPLACE FUNCTION replace_polymarket_passport_v1(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject JSONB := p_payload->'subject';
  v_subject_id TEXT := v_subject->>'subject_id';
  v_wallet TEXT := lower(v_subject->>'primary_wallet');
  v_item JSONB;
  v_epoch BIGINT;
BEGIN
  IF v_subject_id IS NULL OR v_wallet !~ '^0x[0-9a-f]{40}$' THEN
    RAISE EXCEPTION 'INVALID_POLYMARKET_SUBJECT';
  END IF;

  INSERT INTO subjects (
    subject_id, subject_type, primary_wallet, primary_wallet_chain, display_name,
    identity_status, created_at, updated_at
  ) VALUES (
    v_subject_id, v_subject->>'subject_type', v_wallet, 'ethereum', v_subject->>'display_name',
    v_subject->>'identity_status', (v_subject->>'created_at')::timestamptz, (v_subject->>'updated_at')::timestamptz
  )
  ON CONFLICT (subject_id) DO UPDATE SET
    primary_wallet = EXCLUDED.primary_wallet,
    primary_wallet_chain = EXCLUDED.primary_wallet_chain,
    display_name = EXCLUDED.display_name,
    updated_at = EXCLUDED.updated_at;

  -- Serialize rebuilds for one subject so score epochs remain monotonic.
  PERFORM 1 FROM subjects WHERE subject_id = v_subject_id FOR UPDATE;

  -- A transport retry of the exact same verified bundle is a successful no-op.
  SELECT score_epoch INTO v_epoch
  FROM passport_epochs
  WHERE subject_id = v_subject_id
    AND passport_root = p_payload->'passport'->>'passport_root'
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'subject_id', v_subject_id,
      'score_epoch', v_epoch,
      'passport_root', p_payload->'passport'->>'passport_root',
      'idempotent_replay', true
    );
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'markets', '[]'::jsonb)) LOOP
    INSERT INTO canonical_events (
      canonical_event_id, schema_version, title, topic, subtopic, horizon, outcome_type,
      open_time, close_time, resolution_time, resolution_source, normalized_rules,
      market_rules_hash, review_status, warnings, disqualifiers, updated_at
    ) VALUES (
      v_item->>'canonical_event_id', v_item->>'schema_version', v_item->>'title', v_item->>'topic',
      v_item->>'subtopic', v_item->>'horizon', v_item->>'outcome_type',
      (v_item->>'open_time')::timestamptz, (v_item->>'close_time')::timestamptz,
      NULLIF(v_item->>'resolution_time', '')::timestamptz, v_item->>'resolution_source',
      v_item->>'normalized_rules', v_item->>'market_rules_hash', v_item->>'review_status',
      COALESCE(v_item->'warnings', '[]'::jsonb), COALESCE(v_item->'disqualifiers', '[]'::jsonb), now()
    )
    ON CONFLICT (canonical_event_id) DO UPDATE SET
      title = EXCLUDED.title, topic = EXCLUDED.topic, subtopic = EXCLUDED.subtopic, horizon = EXCLUDED.horizon,
      resolution_time = EXCLUDED.resolution_time, resolution_source = EXCLUDED.resolution_source,
      normalized_rules = EXCLUDED.normalized_rules, market_rules_hash = EXCLUDED.market_rules_hash,
      review_status = EXCLUDED.review_status, warnings = EXCLUDED.warnings,
      disqualifiers = EXCLUDED.disqualifiers, updated_at = now();

    INSERT INTO canonical_market_members (
      canonical_event_id, venue, venue_market_id, outcome_mapping, equivalence_score,
      component_scores, warnings, disqualifiers, review_state, reviewer_metadata, normalized_rule_hash
    ) VALUES (
      v_item->>'canonical_event_id', 'polymarket', v_item->>'venue_market_id', v_item->'outcome_mapping',
      (v_item->>'equivalence_score')::numeric, '{}'::jsonb, COALESCE(v_item->'warnings', '[]'::jsonb),
      COALESCE(v_item->'disqualifiers', '[]'::jsonb), v_item->>'review_status',
      jsonb_build_object('publisher', 'polymarket-passport-worker/v1'), v_item->>'market_rules_hash'
    )
    ON CONFLICT (venue, venue_market_id) DO UPDATE SET
      canonical_event_id = EXCLUDED.canonical_event_id, outcome_mapping = EXCLUDED.outcome_mapping,
      equivalence_score = EXCLUDED.equivalence_score, warnings = EXCLUDED.warnings,
      disqualifiers = EXCLUDED.disqualifiers, review_state = EXCLUDED.review_state,
      reviewer_metadata = EXCLUDED.reviewer_metadata, normalized_rule_hash = EXCLUDED.normalized_rule_hash,
      updated_at = now();
  END LOOP;

  DELETE FROM forecast_receipts fr
  WHERE fr.subject_id = v_subject_id AND fr.venue = 'polymarket'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(p_payload->'receipts', '[]'::jsonb)) item
      WHERE item->>'receipt_id' = fr.receipt_id
    );

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'receipts', '[]'::jsonb)) LOOP
    INSERT INTO forecast_receipts (
      receipt_id, subject_id, source_type, venue, venue_account, venue_market_id, canonical_event_id,
      predicted_probability, direction, predicted_at, entry_price, position_size, venue_transaction_reference,
      raw_evidence_hash, ingestion_version, observed_at, evidence_finality, source_checkpoint,
      source_evidence, scoring_metadata
    ) VALUES (
      v_item->>'receipt_id', v_subject_id, v_item->>'source_type', 'polymarket', v_wallet,
      v_item->>'venue_market_id', v_item->>'canonical_event_id', (v_item->>'predicted_probability')::numeric,
      v_item->>'direction', (v_item->>'predicted_at')::timestamptz, (v_item->>'entry_price')::numeric,
      (v_item->>'position_size')::numeric, v_item->>'venue_transaction_reference', v_item->>'raw_evidence_hash',
      v_item->>'ingestion_version', (v_item->>'observed_at')::timestamptz, v_item->>'evidence_finality',
      v_item->>'source_checkpoint', v_item->'source_evidence', COALESCE(v_item->'scoring_metadata', '{}'::jsonb)
    )
    ON CONFLICT (receipt_id) DO UPDATE SET
      canonical_event_id = EXCLUDED.canonical_event_id, observed_at = EXCLUDED.observed_at,
      evidence_finality = EXCLUDED.evidence_finality, source_checkpoint = EXCLUDED.source_checkpoint,
      source_evidence = EXCLUDED.source_evidence, scoring_metadata = EXCLUDED.scoring_metadata;
  END LOOP;

  DELETE FROM resolution_receipts rr
  WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(p_payload->'markets', '[]'::jsonb)) item
    WHERE item->>'canonical_event_id' = rr.canonical_event_id AND item->>'venue' = 'polymarket'
  );
  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'resolutions', '[]'::jsonb)) LOOP
    INSERT INTO resolution_receipts (
      canonical_event_id, venue_market_id, outcome, finality, resolution_source,
      resolved_at, evidence_hash, dispute_status, observed_at
    ) VALUES (
      v_item->>'canonical_event_id', v_item->>'venue_market_id', v_item->>'outcome', v_item->>'finality',
      v_item->>'resolution_source', (v_item->>'resolved_at')::timestamptz, v_item->>'evidence_hash',
      v_item->>'dispute_status', (v_item->>'observed_at')::timestamptz
    );
  END LOOP;

  DELETE FROM topic_score_snapshots WHERE subject_id = v_subject_id AND scoring_version = 'topic-scoring/v1';
  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'snapshots', '[]'::jsonb)) LOOP
    INSERT INTO topic_score_snapshots (
      subject_id, topic, subtopic, horizon, score, snapshot, scoring_version,
      evidence_root, calculated_at, data_window_start, data_window_end
    ) VALUES (
      v_subject_id, v_item->>'topic', v_item->>'subtopic', v_item->>'horizon', (v_item->>'score')::integer,
      v_item->'snapshot', v_item->>'scoring_version', v_item->>'evidence_root',
      (v_item->>'calculated_at')::timestamptz, (v_item->>'data_window_start')::timestamptz,
      (v_item->>'data_window_end')::timestamptz
    );
  END LOOP;

  DELETE FROM underwriting_recommendations WHERE subject_id = v_subject_id;
  v_item := p_payload->'underwriting';
  INSERT INTO underwriting_recommendations (
    subject_id, recommendation, policy_version, passport_root, calculated_at, expires_at, policy_inputs
  ) VALUES (
    v_subject_id, v_item->'recommendation', v_item->>'policy_version', v_item->>'passport_root',
    (v_item->>'calculated_at')::timestamptz, (v_item->>'expires_at')::timestamptz, v_item->'policy_inputs'
  );

  SELECT COALESCE(max(score_epoch), 0) + 1 INTO v_epoch FROM passport_epochs WHERE subject_id = v_subject_id;
  v_item := p_payload->'passport';
  INSERT INTO passport_epochs (
    subject_id, score_epoch, passport_root, evidence_root, cluster, program_id, published_at
  ) VALUES (
    v_subject_id, v_epoch, v_item->>'passport_root', v_item->>'evidence_root', 'offchain', NULL,
    (v_item->>'published_at')::timestamptz
  );
  INSERT INTO passport_bundles (subject_id, passport_root, evidence_root, bundle, report, published_at, updated_at)
  VALUES (
    v_subject_id, v_item->>'passport_root', v_item->>'evidence_root', v_item->'bundle', v_item->'report',
    (v_item->>'published_at')::timestamptz, now()
  )
  ON CONFLICT (subject_id) DO UPDATE SET
    passport_root = EXCLUDED.passport_root, evidence_root = EXCLUDED.evidence_root,
    bundle = EXCLUDED.bundle, report = EXCLUDED.report, published_at = EXCLUDED.published_at, updated_at = now();

  INSERT INTO ingestion_checkpoints (adapter, subject_id, venue_account, checkpoint, updated_at)
  VALUES ('polymarket-passport/v1', v_subject_id, v_wallet, v_item->>'published_at', now())
  ON CONFLICT (adapter, subject_id, venue_account) DO UPDATE SET checkpoint = EXCLUDED.checkpoint, updated_at = now();
  INSERT INTO passport_worker_runs (subject_id, venue, venue_account, status, report, started_at, finished_at)
  VALUES (v_subject_id, 'polymarket', v_wallet, 'complete', v_item->'report', (v_item->>'published_at')::timestamptz, now());

  RETURN jsonb_build_object('subject_id', v_subject_id, 'score_epoch', v_epoch, 'passport_root', v_item->>'passport_root');
END;
$$;

REVOKE ALL ON FUNCTION replace_polymarket_passport_v1(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION replace_polymarket_passport_v1(JSONB) TO service_role;
