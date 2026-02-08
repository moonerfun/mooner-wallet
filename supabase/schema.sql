-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron"; -- For scheduled ranking updates

-- ============================================================================
-- SECTION 1: CORE TABLES
-- ============================================================================

-- ============================================
-- USERS TABLE - Core user profile linked to Twitter/X
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  twitter_id TEXT UNIQUE,
  twitter_username TEXT,
  twitter_display_name TEXT,
  twitter_avatar_url TEXT,
  twitter_followers_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  is_kol BOOLEAN DEFAULT FALSE,
  kol_tier TEXT CHECK (kol_tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_twitter_id ON users(twitter_id);
CREATE INDEX IF NOT EXISTS idx_users_is_kol ON users(is_kol) WHERE is_kol = TRUE;

-- ============================================
-- USER_WALLETS TABLE - Links multiple wallets to a user
-- ============================================
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  chain_type TEXT NOT NULL CHECK (chain_type IN ('evm', 'solana')),
  chain TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  nickname TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet_address, chain_type)
);

CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_address ON user_wallets(wallet_address);

-- ============================================================================
-- SECTION 2: MOBULA CACHE TABLES
-- ============================================================================

-- ============================================
-- KOL_STATS_CACHE TABLE - Cached Mobula analysis data
-- ============================================
CREATE TABLE IF NOT EXISTS kol_stats_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  chain_type TEXT NOT NULL DEFAULT 'solana' CHECK (chain_type IN ('evm', 'solana', 'multi')),
  
  -- Portfolio value
  total_value_usd NUMERIC DEFAULT 0,
  
  -- PnL by period (from Mobula /wallet/analysis)
  pnl_1d_usd NUMERIC DEFAULT 0,
  pnl_7d_usd NUMERIC DEFAULT 0,
  pnl_30d_usd NUMERIC DEFAULT 0,
  pnl_90d_usd NUMERIC DEFAULT 0,
  
  -- Realized vs Unrealized
  realized_pnl_usd NUMERIC DEFAULT 0,
  unrealized_pnl_usd NUMERIC DEFAULT 0,
  
  -- Trading activity
  total_trades INTEGER DEFAULT 0,
  trades_7d INTEGER DEFAULT 0,
  trades_30d INTEGER DEFAULT 0,
  buys_7d INTEGER DEFAULT 0,
  sells_7d INTEGER DEFAULT 0,
  
  -- Volume
  volume_buy_usd NUMERIC DEFAULT 0,
  volume_sell_usd NUMERIC DEFAULT 0,
  total_volume_usd NUMERIC DEFAULT 0,
  volume_7d_usd NUMERIC DEFAULT 0,
  volume_30d_usd NUMERIC DEFAULT 0,
  
  -- Win rate
  win_rate NUMERIC DEFAULT 0,
  win_count INTEGER DEFAULT 0,
  
  -- Holdings
  holding_tokens_count INTEGER DEFAULT 0,
  avg_holding_duration_days NUMERIC DEFAULT 0,
  
  -- Distributions (JSONB from Mobula)
  win_rate_distribution JSONB DEFAULT '{}',
  market_cap_distribution JSONB DEFAULT '{}',
  period_pnl_data JSONB DEFAULT '[]',
  
  -- Best trade info
  best_token_address TEXT,
  best_token_symbol TEXT,
  best_token_name TEXT,
  best_token_logo TEXT,
  best_token_chain TEXT,
  
  -- Mobula labels (smart money, etc.)
  labels TEXT[] DEFAULT '{}',
  
  -- Cache metadata
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_period TEXT DEFAULT '7d',
  
  -- Rankings (computed periodically)
  rank_overall INTEGER,
  rank_7d INTEGER,
  rank_30d INTEGER,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kol_stats_cache_user_id ON kol_stats_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_kol_stats_cache_pnl_7d ON kol_stats_cache(pnl_7d_usd DESC);
CREATE INDEX IF NOT EXISTS idx_kol_stats_cache_wallet ON kol_stats_cache(wallet_address);
CREATE INDEX IF NOT EXISTS idx_kol_stats_cache_rank_7d ON kol_stats_cache(rank_7d);

-- ============================================
-- KOL_TRADES_CACHE TABLE - Cached recent trades from Mobula
-- ============================================
CREATE TABLE IF NOT EXISTS kol_trades_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  
  -- Trade identification
  tx_hash TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  
  -- Trade details
  trade_type TEXT CHECK (trade_type IN ('buy', 'sell')),
  traded_at TIMESTAMPTZ NOT NULL,
  
  -- Amounts
  amount_usd NUMERIC DEFAULT 0,
  amount_base NUMERIC DEFAULT 0,
  amount_quote NUMERIC DEFAULT 0,
  
  -- Base token info (what was bought/sold)
  base_token_address TEXT,
  base_token_symbol TEXT,
  base_token_name TEXT,
  base_token_logo TEXT,
  base_token_price_usd NUMERIC,
  base_token_liquidity_usd NUMERIC,
  base_token_market_cap_usd NUMERIC,
  base_token_price_change_24h NUMERIC,
  
  -- Quote token info
  quote_token_address TEXT,
  quote_token_symbol TEXT,
  quote_token_name TEXT,
  quote_token_logo TEXT,
  
  -- Platform/DEX
  platform TEXT,
  pool_address TEXT,
  
  -- Trader labels
  trader_labels TEXT[] DEFAULT '{}',
  
  -- Cache metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tx_hash, chain_id)
);

CREATE INDEX IF NOT EXISTS idx_kol_trades_cache_user_id ON kol_trades_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_kol_trades_cache_traded_at ON kol_trades_cache(traded_at DESC);
CREATE INDEX IF NOT EXISTS idx_kol_trades_cache_wallet ON kol_trades_cache(wallet_address);
CREATE INDEX IF NOT EXISTS idx_kol_trades_cache_token ON kol_trades_cache(base_token_address);

-- ============================================
-- KOL_POSITIONS_CACHE TABLE - Current positions with PnL
-- ============================================
CREATE TABLE IF NOT EXISTS kol_positions_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  
  -- Token info
  token_address TEXT NOT NULL,
  token_chain_id TEXT NOT NULL,
  token_symbol TEXT,
  token_name TEXT,
  token_logo TEXT,
  token_decimals INTEGER,
  token_price_usd NUMERIC,
  token_liquidity_usd NUMERIC,
  token_market_cap_usd NUMERIC,
  token_price_change_24h NUMERIC,
  
  -- Position data
  balance NUMERIC DEFAULT 0,
  amount_usd NUMERIC DEFAULT 0,
  buys INTEGER DEFAULT 0,
  sells INTEGER DEFAULT 0,
  volume_buy_usd NUMERIC DEFAULT 0,
  volume_sell_usd NUMERIC DEFAULT 0,
  avg_buy_price_usd NUMERIC,
  avg_sell_price_usd NUMERIC,
  
  -- PnL
  realized_pnl_usd NUMERIC DEFAULT 0,
  unrealized_pnl_usd NUMERIC DEFAULT 0,
  total_pnl_usd NUMERIC DEFAULT 0,
  
  -- Dates
  first_trade_date TIMESTAMPTZ,
  last_trade_date TIMESTAMPTZ,
  
  -- Cache metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(wallet_address, token_address, token_chain_id)
);

CREATE INDEX IF NOT EXISTS idx_kol_positions_cache_user_id ON kol_positions_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_kol_positions_cache_wallet ON kol_positions_cache(wallet_address);
CREATE INDEX IF NOT EXISTS idx_kol_positions_cache_token ON kol_positions_cache(token_address);
CREATE INDEX IF NOT EXISTS idx_kol_positions_cache_pnl ON kol_positions_cache(total_pnl_usd DESC);

-- ============================================================================
-- SECTION 3: NOTIFICATION TABLES
-- ============================================================================

-- ============================================
-- PUSH_TOKENS TABLE - Expo push tokens per device/wallet
-- Supports multi-wallet: same token can be registered for multiple wallets
-- ============================================
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  expo_push_token TEXT NOT NULL,
  device_id TEXT,
  device_name TEXT,
  platform TEXT CHECK (platform IN ('ios', 'android')),
  app_version TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Composite unique: same token can exist for multiple wallets (multi-wallet support)
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_wallet_token ON push_tokens(wallet_address, expo_push_token);
-- Non-unique index for token lookups (deactivation)
CREATE INDEX IF NOT EXISTS idx_push_tokens_token_lookup ON push_tokens(expo_push_token);
-- Index for fast wallet lookups
CREATE INDEX IF NOT EXISTS idx_push_tokens_wallet ON push_tokens(wallet_address) WHERE is_active = true;
-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id) WHERE is_active = true;

-- ============================================
-- NOTIFICATION_PREFERENCES TABLE - User settings for notifications
-- ============================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL UNIQUE,
  
  -- Master toggle
  notifications_enabled BOOLEAN DEFAULT true,
  
  -- Whale alerts
  whale_alerts_enabled BOOLEAN DEFAULT true,
  whale_alert_threshold DECIMAL DEFAULT 1000,
  
  -- KOL activity
  kol_activity_enabled BOOLEAN DEFAULT true,
  kol_trade_notifications BOOLEAN DEFAULT true,
  kol_new_position_notifications BOOLEAN DEFAULT true,
  kol_tier_change_notifications BOOLEAN DEFAULT true,
  
  -- Portfolio alerts
  portfolio_alerts_enabled BOOLEAN DEFAULT true,
  price_change_threshold DECIMAL DEFAULT 10,
  pnl_alerts_enabled BOOLEAN DEFAULT true,
  
  -- Copy trading notifications
  copy_trade_enabled BOOLEAN DEFAULT true,
  copy_trade_executed BOOLEAN DEFAULT true,
  copy_trade_failed BOOLEAN DEFAULT true,
  
  -- Social notifications
  new_follower_notifications BOOLEAN DEFAULT true,
  new_copy_trader_notifications BOOLEAN DEFAULT true,
  leaderboard_notifications BOOLEAN DEFAULT true,
  
  -- Market alerts
  trending_token_alerts BOOLEAN DEFAULT false,
  new_listing_alerts BOOLEAN DEFAULT false,
  
  -- Security (always on)
  security_notifications BOOLEAN DEFAULT true,
  
  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '08:00',
  quiet_hours_timezone TEXT DEFAULT 'UTC',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_wallet ON notification_preferences(wallet_address);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);

-- ============================================
-- NOTIFICATIONS TABLE - History of sent notifications
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  
  -- Content
  type TEXT NOT NULL,
  category TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  
  -- Deep linking data
  data JSONB DEFAULT '{}',
  
  -- Delivery status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'clicked')),
  expo_receipt_id TEXT,
  error_message TEXT,
  
  -- Read status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  
  -- Timestamps
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_wallet ON notifications(wallet_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(wallet_address, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status) WHERE status = 'pending';

-- ============================================
-- KOL_FOLLOWS TABLE - Follow relationships for notifications
-- Wallet-based for anonymous auth compatibility
-- ============================================
CREATE TABLE IF NOT EXISTS kol_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Follower info
  follower_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  follower_wallet_address TEXT NOT NULL,
  
  -- KOL being followed
  kol_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  kol_wallet_address TEXT NOT NULL,
  
  -- Notification preferences for this follow
  notify_on_trade BOOLEAN DEFAULT true,
  notify_on_new_position BOOLEAN DEFAULT true,
  notify_on_large_trade BOOLEAN DEFAULT true,
  large_trade_threshold DECIMAL DEFAULT 5000,
  
  -- Copy trade settings
  copy_trade_enabled BOOLEAN DEFAULT false,
  copy_trade_percentage DECIMAL DEFAULT 100,
  copy_trade_max_amount DECIMAL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One follow per wallet pair
  UNIQUE(follower_wallet_address, kol_wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_kol_follows_follower ON kol_follows(follower_wallet_address);
CREATE INDEX IF NOT EXISTS idx_kol_follows_kol ON kol_follows(kol_wallet_address);
CREATE INDEX IF NOT EXISTS idx_kol_follows_notify ON kol_follows(kol_wallet_address, notify_on_trade) WHERE notify_on_trade = true;

-- ============================================
-- KOL_FOLLOWERS TABLE (Legacy - user_id based)
-- Kept for backward compatibility
-- ============================================
CREATE TABLE IF NOT EXISTS kol_followers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  kol_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_user_id, kol_user_id)
);

CREATE INDEX IF NOT EXISTS idx_kol_followers_kol ON kol_followers(kol_user_id);
CREATE INDEX IF NOT EXISTS idx_kol_followers_follower ON kol_followers(follower_user_id);

-- ============================================
-- NOTIFICATION_QUEUE TABLE - Batch processing queue
-- ============================================
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Target type
  target_type TEXT NOT NULL CHECK (target_type IN ('specific', 'followers', 'all', 'whale_subscribers')),
  target_wallets TEXT[],
  target_kol_wallet TEXT,
  
  -- Content
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  
  -- Processing status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  error_message TEXT,
  
  -- Scheduling
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_pending ON notification_queue(scheduled_for) 
  WHERE status = 'pending';

-- ============================================
-- COPY_TRADES TABLE - Copy trading executions
-- ============================================
CREATE TABLE IF NOT EXISTS copy_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  copier_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  original_trade_id UUID,
  kol_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  tx_hash TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'executed', 'failed')),
  copy_amount_usd DECIMAL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_copy_trades_copier ON copy_trades(copier_user_id);
CREATE INDEX IF NOT EXISTS idx_copy_trades_kol ON copy_trades(kol_user_id);
CREATE INDEX IF NOT EXISTS idx_copy_trades_status ON copy_trades(status);

-- ============================================================================
-- SECTION 4: VIEWS
-- ============================================================================

-- ============================================
-- KOL_LEADERBOARD VIEW - Main leaderboard
-- ============================================
CREATE OR REPLACE VIEW kol_leaderboard AS
SELECT 
  u.id,
  u.twitter_username,
  u.twitter_display_name,
  u.twitter_avatar_url,
  u.twitter_followers_count,
  u.is_verified,
  u.kol_tier,
  
  -- Stats from cache
  s.total_value_usd,
  s.pnl_7d_usd,
  s.pnl_30d_usd,
  s.pnl_90d_usd,
  s.realized_pnl_usd as total_realized_pnl_usd,
  s.unrealized_pnl_usd as total_unrealized_pnl_usd,
  s.win_rate,
  s.win_count,
  s.total_trades,
  s.trades_7d,
  s.trades_30d,
  s.volume_7d_usd,
  s.volume_30d_usd,
  s.total_volume_usd,
  s.holding_tokens_count,
  s.avg_holding_duration_days,
  
  -- Distributions
  s.win_rate_distribution,
  s.market_cap_distribution,
  
  -- Best token
  s.best_token_address,
  s.best_token_symbol,
  s.best_token_name,
  s.best_token_logo,
  
  -- Labels
  s.labels,
  
  -- Rankings
  s.rank_overall,
  s.rank_7d,
  s.rank_30d,
  
  -- Cache info
  s.last_synced_at,
  s.wallet_address as primary_wallet,
  s.chain_type,
  
  -- Follower count - from kol_follows (wallet-based) via user_wallets
  (SELECT COUNT(DISTINCT kf.follower_wallet_address) 
   FROM kol_follows kf
   WHERE kf.kol_wallet_address IN (
     SELECT uw.wallet_address FROM user_wallets uw WHERE uw.user_id = u.id
   )
  ) as followers_count,
  
  -- Multi-wallet info
  (SELECT wallet_address FROM user_wallets 
   WHERE user_id = u.id AND chain_type = 'evm' AND is_primary = TRUE 
   LIMIT 1) as primary_evm_wallet,
  (SELECT wallet_address FROM user_wallets 
   WHERE user_id = u.id AND chain_type = 'solana' AND is_primary = TRUE 
   LIMIT 1) as primary_solana_wallet

FROM users u
LEFT JOIN kol_stats_cache s ON u.id = s.user_id
WHERE u.is_kol = TRUE OR s.total_trades > 0
ORDER BY COALESCE(s.rank_7d, 999999), COALESCE(s.pnl_7d_usd, 0) DESC;

-- ============================================
-- KOL_RECENT_TRADES VIEW - Recent trades with position PnL
-- ============================================
CREATE OR REPLACE VIEW kol_recent_trades AS
SELECT 
  t.id,
  t.user_id,
  t.wallet_address,
  t.tx_hash,
  -- Map chain_id to chain name
  CASE 
    WHEN t.chain_id LIKE 'solana%' THEN 'solana'
    WHEN t.chain_id LIKE 'evm:1' OR t.chain_id = 'ethereum' THEN 'ethereum'
    WHEN t.chain_id LIKE 'evm:8453' OR t.chain_id = 'base' THEN 'base'
    WHEN t.chain_id LIKE 'evm:42161' OR t.chain_id = 'arbitrum' THEN 'arbitrum'
    WHEN t.chain_id LIKE 'evm:137' OR t.chain_id = 'polygon' THEN 'polygon'
    ELSE t.chain_id
  END as chain,
  -- Chain type
  CASE 
    WHEN t.chain_id LIKE 'solana%' THEN 'solana'
    ELSE 'evm'
  END as chain_type,
  t.trade_type,
  t.traded_at,
  t.amount_usd,
  t.platform as dex_name,
  
  -- Token in (quote)
  t.quote_token_address as token_in_address,
  t.quote_token_symbol as token_in_symbol,
  t.quote_token_name as token_in_name,
  t.amount_quote as token_in_amount,
  t.amount_quote as token_in_usd_value,
  t.quote_token_logo as token_in_logo,
  
  -- Token out (base)
  t.base_token_address as token_out_address,
  t.base_token_symbol as token_out_symbol,
  t.base_token_name as token_out_name,
  t.amount_base as token_out_amount,
  t.amount_usd as token_out_usd_value,
  t.base_token_logo as token_out_logo,
  
  t.base_token_price_usd as price_usd,
  
  -- PnL from positions cache
  p.realized_pnl_usd,
  p.unrealized_pnl_usd,
  CASE 
    WHEN p.volume_buy_usd > 0 THEN ((p.total_pnl_usd / p.volume_buy_usd) * 100)
    ELSE NULL
  END as pnl_percentage,
  p.total_pnl_usd,
  p.avg_buy_price_usd,
  p.avg_sell_price_usd,
  p.buys as position_buys,
  p.sells as position_sells,
  
  -- User info
  u.twitter_username,
  u.twitter_display_name,
  u.twitter_avatar_url,
  u.is_verified,
  u.kol_tier,
  
  -- Trader labels
  t.trader_labels

FROM kol_trades_cache t
JOIN users u ON t.user_id = u.id
LEFT JOIN kol_positions_cache p ON (
  t.wallet_address = p.wallet_address 
  AND t.base_token_address = p.token_address
)
ORDER BY t.traded_at DESC;

-- ============================================
-- UNREAD_NOTIFICATION_COUNTS VIEW
-- ============================================
CREATE OR REPLACE VIEW unread_notification_counts AS
SELECT 
  wallet_address,
  COUNT(*) as unread_count,
  COUNT(*) FILTER (WHERE type = 'whale_alert') as whale_alerts,
  COUNT(*) FILTER (WHERE type = 'kol_trade') as kol_trades,
  COUNT(*) FILTER (WHERE type = 'portfolio_alert') as portfolio_alerts,
  COUNT(*) FILTER (WHERE type = 'copy_trade') as copy_trades,
  COUNT(*) FILTER (WHERE type = 'security') as security_alerts
FROM notifications
WHERE is_read = false
GROUP BY wallet_address;

-- ============================================
-- KOL_FOLLOWER_COUNTS VIEW
-- ============================================
CREATE OR REPLACE VIEW kol_follower_counts AS
SELECT 
  kol_wallet_address,
  kol_user_id,
  COUNT(*) as follower_count,
  COUNT(*) FILTER (WHERE notify_on_trade = true) as notify_on_trade_count,
  COUNT(*) FILTER (WHERE copy_trade_enabled = true) as copy_traders_count
FROM kol_follows
GROUP BY kol_wallet_address, kol_user_id;

-- ============================================================================
-- SECTION 5: HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kol_stats_cache_updated_at ON kol_stats_cache;
CREATE TRIGGER update_kol_stats_cache_updated_at
  BEFORE UPDATE ON kol_stats_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_push_tokens_updated_at ON push_tokens;
CREATE TRIGGER update_push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kol_follows_updated_at ON kol_follows;
CREATE TRIGGER update_kol_follows_updated_at
  BEFORE UPDATE ON kol_follows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION: Update KOL rankings
-- Run periodically via pg_cron
-- ============================================
CREATE OR REPLACE FUNCTION update_kol_rankings()
RETURNS void AS $$
BEGIN
  -- Update 7d rankings
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY pnl_7d_usd DESC NULLS LAST) as new_rank
    FROM kol_stats_cache WHERE pnl_7d_usd IS NOT NULL
  )
  UPDATE kol_stats_cache sc SET rank_7d = r.new_rank FROM ranked r WHERE sc.id = r.id;

  -- Update 30d rankings
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY pnl_30d_usd DESC NULLS LAST) as new_rank
    FROM kol_stats_cache WHERE pnl_30d_usd IS NOT NULL
  )
  UPDATE kol_stats_cache sc SET rank_30d = r.new_rank FROM ranked r WHERE sc.id = r.id;

  -- Update overall rankings
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY realized_pnl_usd DESC NULLS LAST) as new_rank
    FROM kol_stats_cache
  )
  UPDATE kol_stats_cache sc SET rank_overall = r.new_rank FROM ranked r WHERE sc.id = r.id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 6: NOTIFICATION TRIGGER FUNCTIONS
-- ============================================================================

-- ============================================
-- FUNCTION: Queue whale alert notification
-- ============================================
CREATE OR REPLACE FUNCTION queue_whale_alert_notification()
RETURNS TRIGGER AS $$
DECLARE
  trade_value DECIMAL;
  trader_username TEXT;
  token_symbol TEXT;
BEGIN
  trade_value := COALESCE(NEW.amount_usd, 0);
  
  -- Only for trades >= $1000
  IF trade_value < 1000 THEN
    RETURN NEW;
  END IF;
  
  SELECT COALESCE(twitter_username, 'Trader') INTO trader_username
  FROM users WHERE id = NEW.user_id;
  
  token_symbol := COALESCE(NEW.base_token_symbol, 'Unknown');
  
  INSERT INTO notification_queue (
    target_type, notification_type, title, body, data
  ) VALUES (
    'whale_subscribers',
    'whale_alert',
    '🐋 Whale Alert!',
    format('%s %s $%s worth of %s',
      trader_username,
      CASE NEW.trade_type WHEN 'buy' THEN 'bought' WHEN 'sell' THEN 'sold' ELSE 'swapped' END,
      to_char(trade_value, 'FM999,999,999'),
      token_symbol
    ),
    jsonb_build_object(
      'trade_id', NEW.id,
      'wallet_address', NEW.wallet_address,
      'trader_username', trader_username,
      'trade_type', NEW.trade_type,
      'token_symbol', token_symbol,
      'token_address', NEW.base_token_address,
      'usd_value', trade_value,
      'tx_hash', NEW.tx_hash,
      'chain_id', NEW.chain_id
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Queue KOL follower notification (trade)
-- ============================================
CREATE OR REPLACE FUNCTION queue_kol_follower_notification()
RETURNS TRIGGER AS $$
DECLARE
  kol_username TEXT;
  token_symbol TEXT;
  trade_value DECIMAL;
  has_followers BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM kol_follows 
    WHERE kol_wallet_address = NEW.wallet_address AND notify_on_trade = true
  ) INTO has_followers;
  
  IF NOT has_followers THEN
    RETURN NEW;
  END IF;
  
  SELECT COALESCE(twitter_username, 'KOL') INTO kol_username
  FROM users WHERE id = NEW.user_id;
  
  token_symbol := COALESCE(NEW.base_token_symbol, 'Unknown');
  trade_value := COALESCE(NEW.amount_usd, 0);
  
  INSERT INTO notification_queue (
    target_type, target_kol_wallet, notification_type, title, body, data
  ) VALUES (
    'followers',
    NEW.wallet_address,
    'kol_trade',
    format('🔥 %s just traded!', kol_username),
    format('%s %s%s',
      CASE NEW.trade_type WHEN 'buy' THEN 'Bought' WHEN 'sell' THEN 'Sold' ELSE 'Swapped' END,
      token_symbol,
      CASE WHEN trade_value >= 1000 THEN format(' ($%s)', to_char(trade_value, 'FM999,999,999')) ELSE '' END
    ),
    jsonb_build_object(
      'trade_id', NEW.id,
      'kol_wallet', NEW.wallet_address,
      'kol_username', kol_username,
      'kol_user_id', NEW.user_id,
      'trade_type', NEW.trade_type,
      'token_symbol', token_symbol,
      'token_address', NEW.base_token_address,
      'usd_value', trade_value,
      'tx_hash', NEW.tx_hash,
      'chain_id', NEW.chain_id
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Queue new follower notification
-- ============================================
CREATE OR REPLACE FUNCTION queue_new_follower_notification()
RETURNS TRIGGER AS $$
DECLARE
  follower_username TEXT;
  follower_avatar TEXT;
  kol_wallet TEXT;
BEGIN
  SELECT 
    COALESCE(u.twitter_username, 'Someone'),
    u.twitter_avatar_url
  INTO follower_username, follower_avatar
  FROM users u
  JOIN user_wallets uw ON uw.user_id = u.id
  WHERE uw.wallet_address = NEW.follower_wallet_address
  LIMIT 1;
  
  IF follower_username IS NULL OR follower_username = 'Someone' THEN
    follower_username := CONCAT(LEFT(NEW.follower_wallet_address, 6), '...', RIGHT(NEW.follower_wallet_address, 4));
  END IF;
  
  kol_wallet := NEW.kol_wallet_address;
  
  -- Check if notifications enabled
  IF EXISTS (
    SELECT 1 FROM notification_preferences 
    WHERE wallet_address = kol_wallet AND new_follower_notifications = false
  ) THEN
    RETURN NEW;
  END IF;
  
  INSERT INTO notification_queue (
    target_type, target_wallets, notification_type, title, body, data
  ) VALUES (
    'specific',
    ARRAY[kol_wallet],
    'new_follower',
    '👋 New Follower!',
    format('%s just started following you', follower_username),
    jsonb_build_object(
      'follower_wallet', NEW.follower_wallet_address,
      'follower_username', follower_username,
      'follower_avatar', follower_avatar,
      'kol_wallet', kol_wallet,
      'follow_id', NEW.id,
      'notify_on_trade', NEW.notify_on_trade,
      'notify_on_new_position', NEW.notify_on_new_position,
      'created_at', NEW.created_at
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Queue KOL new position notification
-- ============================================
CREATE OR REPLACE FUNCTION queue_kol_new_position_notification()
RETURNS TRIGGER AS $$
DECLARE
  kol_username TEXT;
  has_followers BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM kol_follows 
    WHERE kol_wallet_address = NEW.wallet_address AND notify_on_new_position = true
  ) INTO has_followers;
  
  IF NOT has_followers THEN
    RETURN NEW;
  END IF;
  
  SELECT COALESCE(u.twitter_username, 'KOL') INTO kol_username
  FROM users u
  JOIN user_wallets uw ON uw.user_id = u.id
  WHERE uw.wallet_address = NEW.wallet_address
  LIMIT 1;
  
  IF kol_username IS NULL OR kol_username = 'KOL' THEN
    kol_username := CONCAT(LEFT(NEW.wallet_address, 6), '...', RIGHT(NEW.wallet_address, 4));
  END IF;
  
  INSERT INTO notification_queue (
    target_type, target_kol_wallet, notification_type, title, body, data
  ) VALUES (
    'followers',
    NEW.wallet_address,
    'kol_new_position',
    format('📊 %s opened a new position!', kol_username),
    format('Now holding %s', COALESCE(NEW.token_symbol, 'Unknown Token')),
    jsonb_build_object(
      'position_id', NEW.id,
      'kol_wallet', NEW.wallet_address,
      'kol_username', kol_username,
      'token_symbol', NEW.token_symbol,
      'token_name', NEW.token_name,
      'token_address', NEW.token_address,
      'token_chain_id', NEW.token_chain_id,
      'amount_usd', COALESCE(NEW.amount_usd, 0),
      'token_logo', NEW.token_logo
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Queue copy trade notification
-- ============================================
CREATE OR REPLACE FUNCTION queue_copy_trade_notification()
RETURNS TRIGGER AS $$
DECLARE
  kol_username TEXT;
  copier_wallet TEXT;
  notification_type TEXT;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  IF NEW.status NOT IN ('executed', 'failed') THEN
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  SELECT uw.wallet_address INTO copier_wallet
  FROM user_wallets uw
  WHERE uw.user_id = NEW.copier_user_id AND uw.is_primary = true
  LIMIT 1;
  
  IF copier_wallet IS NULL THEN
    RETURN NEW;
  END IF;
  
  SELECT COALESCE(u.twitter_username, 'KOL') INTO kol_username
  FROM users u WHERE u.id = NEW.kol_user_id;
  
  IF NEW.status = 'executed' THEN
    notification_type := 'copy_trade_executed';
    notification_title := '✅ Copy Trade Executed!';
    notification_body := format('Successfully copied %s''s trade ($%s)', 
      COALESCE(kol_username, 'KOL'),
      COALESCE(to_char(NEW.copy_amount_usd, 'FM999,999'), '0')
    );
  ELSE
    notification_type := 'copy_trade_failed';
    notification_title := '❌ Copy Trade Failed';
    notification_body := format('Failed to copy %s''s trade. Check your balance.', 
      COALESCE(kol_username, 'KOL')
    );
  END IF;
  
  INSERT INTO notification_queue (
    target_type, target_wallets, notification_type, title, body, data
  ) VALUES (
    'specific',
    ARRAY[copier_wallet],
    notification_type,
    notification_title,
    notification_body,
    jsonb_build_object(
      'copy_trade_id', NEW.id,
      'copier_user_id', NEW.copier_user_id,
      'kol_user_id', NEW.kol_user_id,
      'kol_username', kol_username,
      'original_trade_id', NEW.original_trade_id,
      'tx_hash', NEW.tx_hash,
      'status', NEW.status,
      'copy_amount_usd', NEW.copy_amount_usd
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Queue new copy trader notification
-- ============================================
CREATE OR REPLACE FUNCTION queue_new_copy_trader_notification()
RETURNS TRIGGER AS $$
DECLARE
  copier_username TEXT;
  kol_wallet TEXT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.copy_trade_enabled = true THEN
    -- New follow with copy trading
  ELSIF TG_OP = 'UPDATE' AND OLD.copy_trade_enabled = false AND NEW.copy_trade_enabled = true THEN
    -- Existing follow, copy trading just enabled
  ELSE
    RETURN NEW;
  END IF;
  
  SELECT COALESCE(u.twitter_username, CONCAT(LEFT(NEW.follower_wallet_address, 6), '...', RIGHT(NEW.follower_wallet_address, 4)))
  INTO copier_username
  FROM users u
  JOIN user_wallets uw ON uw.user_id = u.id
  WHERE uw.wallet_address = NEW.follower_wallet_address
  LIMIT 1;
  
  IF copier_username IS NULL THEN
    copier_username := CONCAT(LEFT(NEW.follower_wallet_address, 6), '...', RIGHT(NEW.follower_wallet_address, 4));
  END IF;
  
  kol_wallet := NEW.kol_wallet_address;
  
  IF EXISTS (
    SELECT 1 FROM notification_preferences 
    WHERE wallet_address = kol_wallet AND new_copy_trader_notifications = false
  ) THEN
    RETURN NEW;
  END IF;
  
  INSERT INTO notification_queue (
    target_type, target_wallets, notification_type, title, body, data
  ) VALUES (
    'specific',
    ARRAY[kol_wallet],
    'new_copy_trader',
    '🔄 New Copy Trader!',
    format('%s is now copy trading your moves', copier_username),
    jsonb_build_object(
      'follower_wallet', NEW.follower_wallet_address,
      'copier_username', copier_username,
      'kol_wallet', kol_wallet,
      'follow_id', NEW.id,
      'copy_trade_percentage', NEW.copy_trade_percentage,
      'copy_trade_max_amount', NEW.copy_trade_max_amount
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Legacy new follower (kol_followers table)
-- ============================================
CREATE OR REPLACE FUNCTION queue_new_follower_notification_legacy()
RETURNS TRIGGER AS $$
DECLARE
  follower_username TEXT;
  follower_avatar TEXT;
  kol_wallet TEXT;
BEGIN
  SELECT COALESCE(twitter_username, 'Someone'), twitter_avatar_url
  INTO follower_username, follower_avatar
  FROM users WHERE id = NEW.follower_user_id;
  
  SELECT uw.wallet_address INTO kol_wallet
  FROM user_wallets uw
  WHERE uw.user_id = NEW.kol_user_id AND uw.is_primary = true
  LIMIT 1;
  
  IF kol_wallet IS NULL THEN
    RETURN NEW;
  END IF;
  
  INSERT INTO notification_queue (
    target_type, target_wallets, notification_type, title, body, data
  ) VALUES (
    'specific',
    ARRAY[kol_wallet],
    'new_follower',
    '👋 New Follower!',
    format('%s just started following you', follower_username),
    jsonb_build_object(
      'follower_user_id', NEW.follower_user_id,
      'follower_username', follower_username,
      'follower_avatar', follower_avatar,
      'kol_user_id', NEW.kol_user_id,
      'kol_wallet', kol_wallet,
      'follow_id', NEW.id,
      'created_at', NEW.created_at
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 7: NOTIFICATION TRIGGERS
-- ============================================================================

-- Whale alerts on trade
DROP TRIGGER IF EXISTS trigger_whale_alert ON kol_trades_cache;
CREATE TRIGGER trigger_whale_alert
  AFTER INSERT ON kol_trades_cache
  FOR EACH ROW
  EXECUTE FUNCTION queue_whale_alert_notification();

-- KOL trade notifications
DROP TRIGGER IF EXISTS trigger_kol_follower_notification ON kol_trades_cache;
CREATE TRIGGER trigger_kol_follower_notification
  AFTER INSERT ON kol_trades_cache
  FOR EACH ROW
  EXECUTE FUNCTION queue_kol_follower_notification();

-- New follower notifications (kol_follows)
DROP TRIGGER IF EXISTS trigger_new_follower_notification ON kol_follows;
CREATE TRIGGER trigger_new_follower_notification
  AFTER INSERT ON kol_follows
  FOR EACH ROW
  EXECUTE FUNCTION queue_new_follower_notification();

-- New position notifications
DROP TRIGGER IF EXISTS trigger_kol_new_position_notification ON kol_positions_cache;
CREATE TRIGGER trigger_kol_new_position_notification
  AFTER INSERT ON kol_positions_cache
  FOR EACH ROW
  EXECUTE FUNCTION queue_kol_new_position_notification();

-- Copy trade notifications
DROP TRIGGER IF EXISTS trigger_copy_trade_notification ON copy_trades;
CREATE TRIGGER trigger_copy_trade_notification
  AFTER INSERT OR UPDATE OF status ON copy_trades
  FOR EACH ROW
  EXECUTE FUNCTION queue_copy_trade_notification();

-- New copy trader notifications
DROP TRIGGER IF EXISTS trigger_new_copy_trader_notification ON kol_follows;
CREATE TRIGGER trigger_new_copy_trader_notification
  AFTER INSERT OR UPDATE OF copy_trade_enabled ON kol_follows
  FOR EACH ROW
  EXECUTE FUNCTION queue_new_copy_trader_notification();

-- Legacy follower notifications (if kol_followers exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kol_followers') THEN
    DROP TRIGGER IF EXISTS trigger_new_follower_notification_legacy ON kol_followers;
    CREATE TRIGGER trigger_new_follower_notification_legacy
      AFTER INSERT ON kol_followers
      FOR EACH ROW
      EXECUTE FUNCTION queue_new_follower_notification_legacy();
  END IF;
END;
$$;

-- ============================================================================
-- SECTION 8: RPC FUNCTIONS (SECURITY DEFINER)
-- Bypass RLS for anonymous auth
-- ============================================================================

-- ============================================
-- Notification Preferences RPC
-- ============================================
CREATE OR REPLACE FUNCTION get_or_create_notification_preferences(
  p_wallet_address TEXT
)
RETURNS notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs notification_preferences;
BEGIN
  SELECT * INTO v_prefs FROM notification_preferences WHERE wallet_address = p_wallet_address;
  
  IF v_prefs IS NULL THEN
    INSERT INTO notification_preferences (wallet_address)
    VALUES (p_wallet_address)
    RETURNING * INTO v_prefs;
  END IF;
  
  RETURN v_prefs;
END;
$$;

CREATE OR REPLACE FUNCTION update_notification_preferences_rpc(
  p_wallet_address TEXT,
  p_updates JSONB
)
RETURNS notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs notification_preferences;
BEGIN
  UPDATE notification_preferences
  SET
    notifications_enabled = COALESCE((p_updates->>'notifications_enabled')::boolean, notifications_enabled),
    whale_alerts_enabled = COALESCE((p_updates->>'whale_alerts_enabled')::boolean, whale_alerts_enabled),
    whale_alert_threshold = COALESCE((p_updates->>'whale_alert_threshold')::decimal, whale_alert_threshold),
    kol_activity_enabled = COALESCE((p_updates->>'kol_activity_enabled')::boolean, kol_activity_enabled),
    kol_trade_notifications = COALESCE((p_updates->>'kol_trade_notifications')::boolean, kol_trade_notifications),
    kol_new_position_notifications = COALESCE((p_updates->>'kol_new_position_notifications')::boolean, kol_new_position_notifications),
    kol_tier_change_notifications = COALESCE((p_updates->>'kol_tier_change_notifications')::boolean, kol_tier_change_notifications),
    portfolio_alerts_enabled = COALESCE((p_updates->>'portfolio_alerts_enabled')::boolean, portfolio_alerts_enabled),
    price_change_threshold = COALESCE((p_updates->>'price_change_threshold')::decimal, price_change_threshold),
    pnl_alerts_enabled = COALESCE((p_updates->>'pnl_alerts_enabled')::boolean, pnl_alerts_enabled),
    copy_trade_enabled = COALESCE((p_updates->>'copy_trade_enabled')::boolean, copy_trade_enabled),
    copy_trade_executed = COALESCE((p_updates->>'copy_trade_executed')::boolean, copy_trade_executed),
    copy_trade_failed = COALESCE((p_updates->>'copy_trade_failed')::boolean, copy_trade_failed),
    new_follower_notifications = COALESCE((p_updates->>'new_follower_notifications')::boolean, new_follower_notifications),
    new_copy_trader_notifications = COALESCE((p_updates->>'new_copy_trader_notifications')::boolean, new_copy_trader_notifications),
    leaderboard_notifications = COALESCE((p_updates->>'leaderboard_notifications')::boolean, leaderboard_notifications),
    trending_token_alerts = COALESCE((p_updates->>'trending_token_alerts')::boolean, trending_token_alerts),
    new_listing_alerts = COALESCE((p_updates->>'new_listing_alerts')::boolean, new_listing_alerts),
    security_notifications = COALESCE((p_updates->>'security_notifications')::boolean, security_notifications),
    quiet_hours_enabled = COALESCE((p_updates->>'quiet_hours_enabled')::boolean, quiet_hours_enabled),
    quiet_hours_start = COALESCE((p_updates->>'quiet_hours_start')::time, quiet_hours_start),
    quiet_hours_end = COALESCE((p_updates->>'quiet_hours_end')::time, quiet_hours_end),
    quiet_hours_timezone = COALESCE(p_updates->>'quiet_hours_timezone', quiet_hours_timezone),
    updated_at = NOW()
  WHERE wallet_address = p_wallet_address
  RETURNING * INTO v_prefs;
  
  RETURN v_prefs;
END;
$$;

-- ============================================
-- Push Token RPC (with multi-wallet support)
-- ============================================
CREATE OR REPLACE FUNCTION save_push_token_rpc(
  p_wallet_address TEXT,
  p_expo_push_token TEXT,
  p_device_id TEXT DEFAULT NULL,
  p_device_name TEXT DEFAULT NULL,
  p_platform TEXT DEFAULT NULL,
  p_app_version TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS push_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token push_tokens;
BEGIN
  INSERT INTO push_tokens (
    user_id, wallet_address, expo_push_token, device_id, device_name, platform, app_version,
    is_active, last_used_at, updated_at
  ) VALUES (
    p_user_id, p_wallet_address, p_expo_push_token, p_device_id, p_device_name, p_platform, p_app_version,
    true, NOW(), NOW()
  )
  ON CONFLICT (wallet_address, expo_push_token)
  DO UPDATE SET
    user_id = COALESCE(EXCLUDED.user_id, push_tokens.user_id),
    device_id = COALESCE(EXCLUDED.device_id, push_tokens.device_id),
    device_name = COALESCE(EXCLUDED.device_name, push_tokens.device_name),
    platform = COALESCE(EXCLUDED.platform, push_tokens.platform),
    app_version = COALESCE(EXCLUDED.app_version, push_tokens.app_version),
    is_active = true,
    last_used_at = NOW(),
    updated_at = NOW()
  RETURNING * INTO v_token;
  
  RETURN v_token;
END;
$$;

-- Register token for multiple wallets atomically
CREATE OR REPLACE FUNCTION save_push_token_for_wallets_rpc(
  p_wallet_addresses TEXT[],
  p_expo_push_token TEXT,
  p_device_id TEXT DEFAULT NULL,
  p_device_name TEXT DEFAULT NULL,
  p_platform TEXT DEFAULT NULL,
  p_app_version TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet TEXT;
  v_count INTEGER := 0;
BEGIN
  FOREACH v_wallet IN ARRAY p_wallet_addresses
  LOOP
    INSERT INTO push_tokens (
      user_id, wallet_address, expo_push_token, device_id, device_name, platform, app_version,
      is_active, last_used_at, updated_at
    ) VALUES (
      p_user_id, v_wallet, p_expo_push_token, p_device_id, p_device_name, p_platform, p_app_version,
      true, NOW(), NOW()
    )
    ON CONFLICT (wallet_address, expo_push_token)
    DO UPDATE SET is_active = true, last_used_at = NOW(), updated_at = NOW();
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- ============================================
-- KOL Follow RPC
-- ============================================
CREATE OR REPLACE FUNCTION follow_kol_rpc(
  p_follower_wallet_address TEXT,
  p_kol_wallet_address TEXT,
  p_notify_on_trade BOOLEAN DEFAULT true,
  p_notify_on_new_position BOOLEAN DEFAULT true,
  p_notify_on_large_trade BOOLEAN DEFAULT true,
  p_large_trade_threshold DECIMAL DEFAULT 5000,
  p_copy_trade_enabled BOOLEAN DEFAULT false,
  p_copy_trade_percentage DECIMAL DEFAULT 100,
  p_copy_trade_max_amount DECIMAL DEFAULT NULL
)
RETURNS kol_follows
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_follow kol_follows;
BEGIN
  IF p_follower_wallet_address IS NULL OR p_kol_wallet_address IS NULL THEN
    RAISE EXCEPTION 'Wallet addresses cannot be null';
  END IF;
  
  IF p_follower_wallet_address = p_kol_wallet_address THEN
    RAISE EXCEPTION 'Cannot follow yourself';
  END IF;

  INSERT INTO kol_follows (
    follower_wallet_address, kol_wallet_address,
    notify_on_trade, notify_on_new_position, notify_on_large_trade, large_trade_threshold,
    copy_trade_enabled, copy_trade_percentage, copy_trade_max_amount, updated_at
  ) VALUES (
    p_follower_wallet_address, p_kol_wallet_address,
    p_notify_on_trade, p_notify_on_new_position, p_notify_on_large_trade, p_large_trade_threshold,
    p_copy_trade_enabled, p_copy_trade_percentage, p_copy_trade_max_amount, NOW()
  )
  ON CONFLICT (follower_wallet_address, kol_wallet_address)
  DO UPDATE SET
    notify_on_trade = EXCLUDED.notify_on_trade,
    notify_on_new_position = EXCLUDED.notify_on_new_position,
    notify_on_large_trade = EXCLUDED.notify_on_large_trade,
    large_trade_threshold = EXCLUDED.large_trade_threshold,
    copy_trade_enabled = EXCLUDED.copy_trade_enabled,
    copy_trade_percentage = EXCLUDED.copy_trade_percentage,
    copy_trade_max_amount = EXCLUDED.copy_trade_max_amount,
    updated_at = NOW()
  RETURNING * INTO v_follow;
  
  RETURN v_follow;
END;
$$;

CREATE OR REPLACE FUNCTION unfollow_kol_rpc(
  p_follower_wallet_address TEXT,
  p_kol_wallet_address TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM kol_follows
  WHERE follower_wallet_address = p_follower_wallet_address
    AND kol_wallet_address = p_kol_wallet_address;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION is_following_kol_rpc(
  p_follower_wallet_address TEXT,
  p_kol_wallet_address TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM kol_follows
    WHERE follower_wallet_address = p_follower_wallet_address
      AND kol_wallet_address = p_kol_wallet_address
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_followed_kols_rpc(
  p_follower_wallet_address TEXT
)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN ARRAY(
    SELECT kol_wallet_address FROM kol_follows
    WHERE follower_wallet_address = p_follower_wallet_address
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_kol_follow_details_rpc(
  p_follower_wallet_address TEXT,
  p_kol_wallet_address TEXT
)
RETURNS kol_follows
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_follow kol_follows;
BEGIN
  SELECT * INTO v_follow FROM kol_follows
  WHERE follower_wallet_address = p_follower_wallet_address
    AND kol_wallet_address = p_kol_wallet_address;
  RETURN v_follow;
END;
$$;

-- ============================================================================
-- SECTION 9: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE kol_stats_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE kol_trades_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE kol_positions_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE kol_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE kol_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_trades ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PUBLIC READ POLICIES (for leaderboard/views)
-- ============================================
CREATE POLICY "Users viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "User wallets viewable by everyone" ON user_wallets FOR SELECT USING (true);
CREATE POLICY "Stats cache viewable by everyone" ON kol_stats_cache FOR SELECT USING (true);
CREATE POLICY "Trades cache viewable by everyone" ON kol_trades_cache FOR SELECT USING (true);
CREATE POLICY "Positions cache viewable by everyone" ON kol_positions_cache FOR SELECT USING (true);
CREATE POLICY "Followers viewable by everyone" ON kol_followers FOR SELECT USING (true);

-- ============================================
-- WRITE POLICIES (for cache updates)
-- ============================================
CREATE POLICY "Anyone can create users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update users" ON users FOR UPDATE USING (true);
CREATE POLICY "Anyone can create wallet links" ON user_wallets FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update wallet links" ON user_wallets FOR UPDATE USING (true);
CREATE POLICY "Anyone can manage stats cache" ON kol_stats_cache FOR ALL USING (true);
CREATE POLICY "Anyone can manage trades cache" ON kol_trades_cache FOR ALL USING (true);
CREATE POLICY "Anyone can manage positions cache" ON kol_positions_cache FOR ALL USING (true);
CREATE POLICY "Anyone can manage followers" ON kol_followers FOR ALL USING (true);

-- ============================================
-- ANON ROLE POLICIES (for mobile app)
-- ============================================

-- Push tokens
CREATE POLICY "push_tokens_anon_select" ON push_tokens FOR SELECT TO anon USING (true);
CREATE POLICY "push_tokens_anon_insert" ON push_tokens FOR INSERT TO anon WITH CHECK (wallet_address IS NOT NULL);
CREATE POLICY "push_tokens_anon_update" ON push_tokens FOR UPDATE TO anon USING (true) WITH CHECK (wallet_address IS NOT NULL);
CREATE POLICY "push_tokens_anon_delete" ON push_tokens FOR DELETE TO anon USING (true);

-- Notification preferences
CREATE POLICY "notification_prefs_anon_select" ON notification_preferences FOR SELECT TO anon USING (true);
CREATE POLICY "notification_prefs_anon_insert" ON notification_preferences FOR INSERT TO anon WITH CHECK (wallet_address IS NOT NULL);
CREATE POLICY "notification_prefs_anon_update" ON notification_preferences FOR UPDATE TO anon USING (true) WITH CHECK (wallet_address IS NOT NULL);

-- Notifications (read only for users)
CREATE POLICY "notifications_anon_select" ON notifications FOR SELECT TO anon USING (true);

-- KOL follows
CREATE POLICY "kol_follows_anon_select" ON kol_follows FOR SELECT TO anon USING (true);
CREATE POLICY "kol_follows_anon_insert" ON kol_follows FOR INSERT TO anon WITH CHECK (follower_wallet_address IS NOT NULL);
CREATE POLICY "kol_follows_anon_update" ON kol_follows FOR UPDATE TO anon USING (true) WITH CHECK (follower_wallet_address IS NOT NULL);
CREATE POLICY "kol_follows_anon_delete" ON kol_follows FOR DELETE TO anon USING (true);

-- Copy trades (read for users)
CREATE POLICY "copy_trades_anon_select" ON copy_trades FOR SELECT TO anon USING (true);

-- ============================================
-- SERVICE ROLE POLICIES (for edge functions)
-- ============================================
CREATE POLICY "push_tokens_service_policy" ON push_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "notifications_service_policy" ON notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "notification_queue_service_policy" ON notification_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "kol_follows_service_policy" ON kol_follows FOR SELECT TO service_role USING (true);
CREATE POLICY "copy_trades_service_policy" ON copy_trades FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- SECTION 10: GRANT PERMISSIONS
-- ============================================================================

-- Grant execute on RPC functions to anon role
GRANT EXECUTE ON FUNCTION get_or_create_notification_preferences(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION update_notification_preferences_rpc(TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION save_push_token_rpc(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION save_push_token_for_wallets_rpc(TEXT[], TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION follow_kol_rpc(TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, DECIMAL, BOOLEAN, DECIMAL, DECIMAL) TO anon;
GRANT EXECUTE ON FUNCTION unfollow_kol_rpc(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION is_following_kol_rpc(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_followed_kols_rpc(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_kol_follow_details_rpc(TEXT, TEXT) TO anon;

-- ============================================================================
-- SECTION 11: COMMENTS
-- ============================================================================

COMMENT ON TABLE users IS 'User profiles linked to Twitter/X accounts';
COMMENT ON TABLE user_wallets IS 'Multi-wallet support - links wallets to users';
COMMENT ON TABLE kol_stats_cache IS 'Cached Mobula wallet analysis data';
COMMENT ON TABLE kol_trades_cache IS 'Cached recent trades from Mobula';
COMMENT ON TABLE kol_positions_cache IS 'Cached positions with PnL from Mobula';
COMMENT ON TABLE push_tokens IS 'Expo push notification tokens per device/wallet (multi-wallet supported)';
COMMENT ON TABLE notification_preferences IS 'User notification preferences';
COMMENT ON TABLE notifications IS 'History of sent notifications';
COMMENT ON TABLE kol_follows IS 'Follow relationships for notifications (wallet-based)';
COMMENT ON TABLE kol_followers IS 'Legacy follow table (user_id based) - kept for backward compatibility';
COMMENT ON TABLE notification_queue IS 'Queue for batch processing notifications';
COMMENT ON TABLE copy_trades IS 'Copy trading executions';

COMMENT ON VIEW kol_leaderboard IS 'KOL leaderboard with cached stats and follower counts from kol_follows';
COMMENT ON VIEW kol_recent_trades IS 'Recent trades with position-level PnL data';
COMMENT ON VIEW unread_notification_counts IS 'Unread notification counts by wallet';
COMMENT ON VIEW kol_follower_counts IS 'Follower and copy trader counts per KOL';

COMMENT ON FUNCTION update_kol_rankings() IS 'Updates KOL rankings - run via pg_cron every 5 minutes';
COMMENT ON FUNCTION save_push_token_rpc IS 'Saves push token for a wallet (SECURITY DEFINER)';
COMMENT ON FUNCTION save_push_token_for_wallets_rpc IS 'Saves push token for multiple wallets atomically (multi-wallet)';
COMMENT ON FUNCTION follow_kol_rpc IS 'Creates or updates KOL follow (SECURITY DEFINER)';
COMMENT ON FUNCTION unfollow_kol_rpc IS 'Removes KOL follow (SECURITY DEFINER)';
COMMENT ON FUNCTION is_following_kol_rpc IS 'Checks if following a KOL (SECURITY DEFINER)';
COMMENT ON FUNCTION get_followed_kols_rpc IS 'Returns array of followed KOL wallets (SECURITY DEFINER)';
COMMENT ON FUNCTION get_kol_follow_details_rpc IS 'Returns full follow relationship details (SECURITY DEFINER)';


-- Make all notification trigger functions run with owner privileges
ALTER FUNCTION queue_kol_new_position_notification() SECURITY DEFINER;
ALTER FUNCTION queue_kol_follower_notification() SECURITY DEFINER;
ALTER FUNCTION queue_whale_alert_notification() SECURITY DEFINER;
ALTER FUNCTION queue_new_follower_notification() SECURITY DEFINER;
ALTER FUNCTION queue_copy_trade_notification() SECURITY DEFINER;
ALTER FUNCTION queue_new_copy_trader_notification() SECURITY DEFINER;
-- ============================================================================
-- OPTIONAL: Schedule ranking updates via pg_cron
-- Run this after enabling the pg_cron extension
-- ============================================================================
-- SELECT cron.schedule('update-kol-rankings', '*/5 * * * *', 'SELECT update_kol_rankings()');

-- ============================================================================
-- END OF SCHEMA V2
-- ============================================================================
