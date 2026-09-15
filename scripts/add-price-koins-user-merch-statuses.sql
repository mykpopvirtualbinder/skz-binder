-- Optional K-oins asking price for merch WTS (alongside fiat price).
ALTER TABLE user_merch_statuses
  ADD COLUMN IF NOT EXISTS price_koins integer;

COMMENT ON COLUMN user_merch_statuses.price_koins IS 'Optional asking price in K-oins for merch WTS listings';
