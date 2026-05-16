-- Fix social_mentions ON CONFLICT issue
-- Drop the partial index that interferes with upsert

DROP INDEX IF EXISTS idx_social_hash;

-- Verify unique constraint remains
SELECT indexname FROM pg_indexes
WHERE tablename = 'social_mentions' AND indexname LIKE '%hash%';
