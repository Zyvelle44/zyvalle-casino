-- Zyvalle Bet Phase 2: wallet ledger and idempotent money requests.
-- Run once against a BACKUP of the production database before deploying the Phase 2 API.
-- Requires MySQL 8.0+ and InnoDB tables.

ALTER TABLE transactions
  ADD COLUMN idempotency_key VARCHAR(100) NULL AFTER note,
  ADD UNIQUE KEY uq_transactions_user_idempotency (user_id, idempotency_key);

CREATE TABLE wallet_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  transaction_id BIGINT UNSIGNED NULL,
  entry_type ENUM(
    'opening_balance',
    'deposit_credit',
    'withdrawal_reserve',
    'withdrawal_refund',
    'admin_adjustment',
    'game_debit',
    'game_credit'
  ) NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  balance_after DECIMAL(18,2) NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  idempotency_key VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wallet_ledger_tx_event (transaction_id, entry_type),
  KEY idx_wallet_ledger_user_created (user_id, created_at, id),
  CONSTRAINT fk_wallet_ledger_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_wallet_ledger_transaction FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_wallet_ledger_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_wallet_ledger_amount_range CHECK (amount BETWEEN -9999999999999999.99 AND 9999999999999999.99),
  CONSTRAINT chk_wallet_ledger_balance_nonnegative CHECK (balance_after >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Establish a starting point for each existing wallet. Historical movements before
-- this migration cannot be reconstructed reliably from current wallet balances alone.
INSERT INTO wallet_ledger (user_id, transaction_id, entry_type, amount, balance_after, actor_user_id)
SELECT user_id, NULL, 'opening_balance', balance, balance, NULL
FROM wallets;

-- Important: the application does not allow updates/deletes to ledger entries.
-- Restrict direct database access to trusted operators; enforce DB permissions separately.
