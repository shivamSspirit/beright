/-
Proofs.lean — user-owned preservation proofs.

`qedgen codegen` bootstraps this file once and never touches it again.
Spec.lean is regenerated; this file is durable. `qedgen check`
(and `qedgen reconcile`) flag orphan theorems (handler removed from
spec) and missing obligations (new `preserved_by` declared).
-/
import Spec

namespace BeRightCapital

open QEDGen.Solana

-- Preservation obligations the spec expects.
-- Write each theorem against the signature generated in Spec.lean
-- (the handler's transition + the property predicate). Close with
-- tactics like `unfold`, `omega`, or `simp_all` as appropriate, or
-- `QEDGen.Solana.IndexedState.forall_update_pres` for per-account
-- invariants in Map-backed specs.
--
--   theorem agent_nonce_is_monotonic_preserved_by_borrow
--   theorem agent_nonce_is_monotonic_preserved_by_cancel_agent_intent
--   theorem agent_nonce_is_monotonic_preserved_by_claim_yield
--   theorem agent_nonce_is_monotonic_preserved_by_configure_strategy
--   theorem agent_nonce_is_monotonic_preserved_by_create_agent_intent
--   theorem agent_nonce_is_monotonic_preserved_by_deposit
--   theorem agent_nonce_is_monotonic_preserved_by_execute_agent_intent
--   theorem agent_nonce_is_monotonic_preserved_by_fund_lending
--   theorem agent_nonce_is_monotonic_preserved_by_harvest_yield
--   theorem agent_nonce_is_monotonic_preserved_by_initialize_lender
--   theorem agent_nonce_is_monotonic_preserved_by_initialize_lending_pool
--   theorem agent_nonce_is_monotonic_preserved_by_initialize_loan
--   theorem agent_nonce_is_monotonic_preserved_by_initialize_market
--   theorem agent_nonce_is_monotonic_preserved_by_initialize_position
--   theorem agent_nonce_is_monotonic_preserved_by_initialize_protocol
--   theorem agent_nonce_is_monotonic_preserved_by_liquidate
--   theorem agent_nonce_is_monotonic_preserved_by_match_positions
--   theorem agent_nonce_is_monotonic_preserved_by_pause
--   theorem agent_nonce_is_monotonic_preserved_by_repay
--   theorem agent_nonce_is_monotonic_preserved_by_resolve_market
--   theorem agent_nonce_is_monotonic_preserved_by_unmatch_positions
--   theorem agent_nonce_is_monotonic_preserved_by_unpause
--   theorem agent_nonce_is_monotonic_preserved_by_update_price
--   theorem agent_nonce_is_monotonic_preserved_by_withdraw_lending
--   theorem agent_nonce_is_monotonic_preserved_by_withdraw_unmatched
--   theorem lending_is_conserved_preserved_by_borrow
--   theorem lending_is_conserved_preserved_by_cancel_agent_intent
--   theorem lending_is_conserved_preserved_by_claim_yield
--   theorem lending_is_conserved_preserved_by_configure_strategy
--   theorem lending_is_conserved_preserved_by_create_agent_intent
--   theorem lending_is_conserved_preserved_by_deposit
--   theorem lending_is_conserved_preserved_by_execute_agent_intent
--   theorem lending_is_conserved_preserved_by_fund_lending
--   theorem lending_is_conserved_preserved_by_harvest_yield
--   theorem lending_is_conserved_preserved_by_initialize_lender
--   theorem lending_is_conserved_preserved_by_initialize_lending_pool
--   theorem lending_is_conserved_preserved_by_initialize_loan
--   theorem lending_is_conserved_preserved_by_initialize_market
--   theorem lending_is_conserved_preserved_by_initialize_position
--   theorem lending_is_conserved_preserved_by_initialize_protocol
--   theorem lending_is_conserved_preserved_by_liquidate
--   theorem lending_is_conserved_preserved_by_match_positions
--   theorem lending_is_conserved_preserved_by_pause
--   theorem lending_is_conserved_preserved_by_repay
--   theorem lending_is_conserved_preserved_by_resolve_market
--   theorem lending_is_conserved_preserved_by_unmatch_positions
--   theorem lending_is_conserved_preserved_by_unpause
--   theorem lending_is_conserved_preserved_by_update_price
--   theorem lending_is_conserved_preserved_by_withdraw_lending
--   theorem lending_is_conserved_preserved_by_withdraw_unmatched
--   theorem matched_pairs_are_backed_preserved_by_borrow
--   theorem matched_pairs_are_backed_preserved_by_cancel_agent_intent
--   theorem matched_pairs_are_backed_preserved_by_claim_yield
--   theorem matched_pairs_are_backed_preserved_by_configure_strategy
--   theorem matched_pairs_are_backed_preserved_by_create_agent_intent
--   theorem matched_pairs_are_backed_preserved_by_deposit
--   theorem matched_pairs_are_backed_preserved_by_execute_agent_intent
--   theorem matched_pairs_are_backed_preserved_by_fund_lending
--   theorem matched_pairs_are_backed_preserved_by_harvest_yield
--   theorem matched_pairs_are_backed_preserved_by_initialize_lender
--   theorem matched_pairs_are_backed_preserved_by_initialize_lending_pool
--   theorem matched_pairs_are_backed_preserved_by_initialize_loan
--   theorem matched_pairs_are_backed_preserved_by_initialize_market
--   theorem matched_pairs_are_backed_preserved_by_initialize_position
--   theorem matched_pairs_are_backed_preserved_by_initialize_protocol
--   theorem matched_pairs_are_backed_preserved_by_liquidate
--   theorem matched_pairs_are_backed_preserved_by_match_positions
--   theorem matched_pairs_are_backed_preserved_by_pause
--   theorem matched_pairs_are_backed_preserved_by_repay
--   theorem matched_pairs_are_backed_preserved_by_resolve_market
--   theorem matched_pairs_are_backed_preserved_by_unmatch_positions
--   theorem matched_pairs_are_backed_preserved_by_unpause
--   theorem matched_pairs_are_backed_preserved_by_update_price
--   theorem matched_pairs_are_backed_preserved_by_withdraw_lending
--   theorem matched_pairs_are_backed_preserved_by_withdraw_unmatched
--   theorem strategy_is_pair_backed_preserved_by_borrow
--   theorem strategy_is_pair_backed_preserved_by_cancel_agent_intent
--   theorem strategy_is_pair_backed_preserved_by_claim_yield
--   theorem strategy_is_pair_backed_preserved_by_configure_strategy
--   theorem strategy_is_pair_backed_preserved_by_create_agent_intent
--   theorem strategy_is_pair_backed_preserved_by_deposit
--   theorem strategy_is_pair_backed_preserved_by_execute_agent_intent
--   theorem strategy_is_pair_backed_preserved_by_fund_lending
--   theorem strategy_is_pair_backed_preserved_by_harvest_yield
--   theorem strategy_is_pair_backed_preserved_by_initialize_lender
--   theorem strategy_is_pair_backed_preserved_by_initialize_lending_pool
--   theorem strategy_is_pair_backed_preserved_by_initialize_loan
--   theorem strategy_is_pair_backed_preserved_by_initialize_market
--   theorem strategy_is_pair_backed_preserved_by_initialize_position
--   theorem strategy_is_pair_backed_preserved_by_initialize_protocol
--   theorem strategy_is_pair_backed_preserved_by_liquidate
--   theorem strategy_is_pair_backed_preserved_by_match_positions
--   theorem strategy_is_pair_backed_preserved_by_pause
--   theorem strategy_is_pair_backed_preserved_by_repay
--   theorem strategy_is_pair_backed_preserved_by_resolve_market
--   theorem strategy_is_pair_backed_preserved_by_unmatch_positions
--   theorem strategy_is_pair_backed_preserved_by_unpause
--   theorem strategy_is_pair_backed_preserved_by_update_price
--   theorem strategy_is_pair_backed_preserved_by_withdraw_lending
--   theorem strategy_is_pair_backed_preserved_by_withdraw_unmatched
--   theorem yield_cannot_be_overclaimed_preserved_by_borrow
--   theorem yield_cannot_be_overclaimed_preserved_by_cancel_agent_intent
--   theorem yield_cannot_be_overclaimed_preserved_by_claim_yield
--   theorem yield_cannot_be_overclaimed_preserved_by_configure_strategy
--   theorem yield_cannot_be_overclaimed_preserved_by_create_agent_intent
--   theorem yield_cannot_be_overclaimed_preserved_by_deposit
--   theorem yield_cannot_be_overclaimed_preserved_by_execute_agent_intent
--   theorem yield_cannot_be_overclaimed_preserved_by_fund_lending
--   theorem yield_cannot_be_overclaimed_preserved_by_harvest_yield
--   theorem yield_cannot_be_overclaimed_preserved_by_initialize_lender
--   theorem yield_cannot_be_overclaimed_preserved_by_initialize_lending_pool
--   theorem yield_cannot_be_overclaimed_preserved_by_initialize_loan
--   theorem yield_cannot_be_overclaimed_preserved_by_initialize_market
--   theorem yield_cannot_be_overclaimed_preserved_by_initialize_position
--   theorem yield_cannot_be_overclaimed_preserved_by_initialize_protocol
--   theorem yield_cannot_be_overclaimed_preserved_by_liquidate
--   theorem yield_cannot_be_overclaimed_preserved_by_match_positions
--   theorem yield_cannot_be_overclaimed_preserved_by_pause
--   theorem yield_cannot_be_overclaimed_preserved_by_repay
--   theorem yield_cannot_be_overclaimed_preserved_by_resolve_market
--   theorem yield_cannot_be_overclaimed_preserved_by_unmatch_positions
--   theorem yield_cannot_be_overclaimed_preserved_by_unpause
--   theorem yield_cannot_be_overclaimed_preserved_by_update_price
--   theorem yield_cannot_be_overclaimed_preserved_by_withdraw_lending
--   theorem yield_cannot_be_overclaimed_preserved_by_withdraw_unmatched

end BeRightCapital
