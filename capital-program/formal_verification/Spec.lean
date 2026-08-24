import QEDGen.Solana.Account
import QEDGen.Solana.Cpi
import QEDGen.Solana.State
import QEDGen.Solana.Valid

namespace BeRightCapital

open QEDGen.Solana

abbrev MAX_TVL : Nat := 1000000000000

structure State where
  config_initialized : Nat
  market_count : Nat
  position_count : Nat
  lender_count : Nat
  loan_count : Nat
  paused : Nat
  strategy_enabled : Nat
  pending_strategy_enabled : Nat
  strategy_activate_after : Nat
  pending_admin : Nat
  total_yes : Nat
  total_no : Nat
  matched_pairs : Nat
  strategy_principal : Nat
  harvested_yield : Nat
  claimed_yield : Nat
  total_cash : Nat
  total_borrows : Nat
  total_lender_shares : Nat
  collateral_amount : Nat
  bad_debt : Nat
  status : Nat
  next_intent_nonce : Nat
  consumed : Nat
  observed_slot : Nat
  deriving Repr, DecidableEq, BEq

def initialize_protocolTransition (s : State) (signer : Pubkey) : Option State :=
  let upgrade_authority := signer
  if s.qed_status = .Active ∧ s.config_initialized = 0 then
    some { s with config_initialized := 1, strategy_activate_after := 0, pending_strategy_enabled := 0, pending_admin := 0, qed_status := .Active }
  else none

def initialize_marketTransition (s : State) (signer : Pubkey) : Option State :=
  let admin := signer
  if s.qed_status = .Active ∧ s.config_initialized = 1 ∧ s.market_count + 1 ≤ 1000000000000 then
    some { s with market_count := s.market_count + 1, qed_status := .Active }
  else none

def initialize_positionTransition (s : State) (signer : Pubkey) : Option State :=
  let owner := signer
  if s.qed_status = .Active ∧ s.position_count + 1 ≤ 1000000000000 then
    some { s with position_count := s.position_count + 1, qed_status := .Active }
  else none

def pauseTransition (s : State) (signer : Pubkey) : Option State :=
  let emergency_authority := signer
  if s.qed_status = .Active then
    some { s with paused := 1, qed_status := .Active }
  else none

def unpauseTransition (s : State) (signer : Pubkey) : Option State :=
  let admin := signer
  if s.qed_status = .Active then
    some { s with paused := 0, qed_status := .Active }
  else none

def configure_strategyTransition (s : State) (signer : Pubkey) (enabled : Nat) : Option State :=
  let admin := signer
  if s.qed_status = .Active ∧ enabled ≤ 1 then
    some { s with pending_strategy_enabled := enabled, strategy_activate_after := 1, qed_status := .Active }
  else none

def activate_strategyTransition (s : State) (signer : Pubkey) : Option State :=
  if s.qed_status = .Active ∧ s.strategy_activate_after > 0 then
    some { s with strategy_enabled := pending_strategy_enabled, pending_strategy_enabled := 0, strategy_activate_after := 0, qed_status := .Active }
  else none

def cancel_strategy_changeTransition (s : State) (signer : Pubkey) : Option State :=
  let admin := signer
  if s.qed_status = .Active ∧ s.strategy_activate_after > 0 then
    some { s with pending_strategy_enabled := 0, strategy_activate_after := 0, qed_status := .Active }
  else none

def propose_adminTransition (s : State) (signer : Pubkey) : Option State :=
  let admin := signer
  if s.qed_status = .Active then
    some { s with pending_admin := 1, qed_status := .Active }
  else none

def accept_adminTransition (s : State) (signer : Pubkey) : Option State :=
  if signer = s.pending_admin ∧ s.qed_status = .Active ∧ s.pending_admin = 1 then
    some { s with pending_admin := 0, qed_status := .Active }
  else none

def depositTransition (s : State) (signer : Pubkey) (side : Nat) (amount : Nat) : Option State :=
  if s.qed_status = .Active ∧ s.paused = 0 ∧ side ≤ 1 ∧ amount > 0 ∧ s.total_yes + amount ≤ 1000000000000 ∧ s.total_no + amount ≤ 1000000000000 then
    some { s with total_yes := s.total_yes + amount, total_no := s.total_no + amount, qed_status := .Active }
  else none

def withdraw_unmatchedTransition (s : State) (signer : Pubkey) (side : Nat) (amount : Nat) : Option State :=
  let owner := signer
  if s.qed_status = .Active ∧ amount ≤ s.total_yes ∧ amount ≤ s.total_no ∧ side ≤ 1 ∧ amount > 0 ∧ s.total_yes - s.matched_pairs ≥ amount ∧ s.total_no - s.matched_pairs ≥ amount then
    some { s with total_yes := s.total_yes - amount, total_no := s.total_no - amount, qed_status := .Active }
  else none

def match_positionsTransition (s : State) (signer : Pubkey) (amount : Nat) : Option State :=
  if s.qed_status = .Active ∧ s.paused = 0 ∧ amount > 0 ∧ s.total_yes - s.matched_pairs ≥ amount ∧ s.total_no - s.matched_pairs ≥ amount ∧ s.matched_pairs + amount ≤ 1000000000000 then
    some { s with matched_pairs := s.matched_pairs + amount, qed_status := .Active }
  else none

def unmatch_positionsTransition (s : State) (signer : Pubkey) (amount : Nat) : Option State :=
  let owners_or_resolved_keeper := signer
  if s.qed_status = .Active ∧ amount ≤ s.matched_pairs ∧ amount > 0 ∧ s.matched_pairs ≥ amount ∧ s.strategy_principal ≤ s.matched_pairs - amount then
    some { s with matched_pairs := s.matched_pairs - amount, qed_status := .Active }
  else none

def harvest_yieldTransition (s : State) (signer : Pubkey) (amount : Nat) : Option State :=
  let strategy_authority := signer
  if s.qed_status = .Active ∧ s.paused = 0 ∧ s.strategy_enabled = 1 ∧ amount > 0 ∧ s.matched_pairs > 0 ∧ s.harvested_yield + amount ≤ 1000000000000 then
    some { s with harvested_yield := s.harvested_yield + amount, qed_status := .Active }
  else none

def claim_yieldTransition (s : State) (signer : Pubkey) (amount : Nat) : Option State :=
  let owner := signer
  if s.qed_status = .Active ∧ amount > 0 ∧ s.harvested_yield - s.claimed_yield ≥ amount ∧ s.claimed_yield + amount ≤ 1000000000000 then
    some { s with claimed_yield := s.claimed_yield + amount, qed_status := .Active }
  else none

def resolve_marketTransition (s : State) (signer : Pubkey) (winning_side : Nat) : Option State :=
  let resolution_authority := signer
  if s.qed_status = .Active ∧ s.status = 0 ∧ winning_side ≤ 1 ∧ s.strategy_principal = 0 then
    some { s with status := 1, qed_status := .Active }
  else none

def update_priceTransition (s : State) (signer : Pubkey) (observed_slot : Nat) : Option State :=
  let oracle_authority := signer
  if s.qed_status = .Active ∧ observed_slot > s.observed_slot then
    some { s with observed_slot := observed_slot, qed_status := .Active }
  else none

def initialize_lending_poolTransition (s : State) (signer : Pubkey) : Option State :=
  if s.qed_status = .Active ∧ s.total_cash = 0 ∧ s.total_borrows = 0 then
    some { s with bad_debt := 0, qed_status := .Active }
  else none

def initialize_lenderTransition (s : State) (signer : Pubkey) : Option State :=
  let owner := signer
  if s.qed_status = .Active ∧ s.lender_count + 1 ≤ 1000000000000 then
    some { s with lender_count := s.lender_count + 1, qed_status := .Active }
  else none

def fund_lendingTransition (s : State) (signer : Pubkey) (amount : Nat) : Option State :=
  let owner := signer
  if s.qed_status = .Active ∧ s.paused = 0 ∧ amount > 0 ∧ s.total_cash + amount ≤ 1000000000000 ∧ s.total_lender_shares + amount ≤ 1000000000000 then
    some { s with total_cash := s.total_cash + amount, total_lender_shares := s.total_lender_shares + amount, qed_status := .Active }
  else none

def withdraw_lendingTransition (s : State) (signer : Pubkey) (shares : Nat) : Option State :=
  let owner := signer
  if s.qed_status = .Active ∧ shares ≤ s.total_cash ∧ shares ≤ s.total_lender_shares ∧ shares > 0 ∧ s.total_lender_shares ≥ shares ∧ s.total_cash ≥ shares then
    some { s with total_cash := s.total_cash - shares, total_lender_shares := s.total_lender_shares - shares, qed_status := .Active }
  else none

def initialize_loanTransition (s : State) (signer : Pubkey) : Option State :=
  let borrower := signer
  if s.qed_status = .Active ∧ s.loan_count + 1 ≤ 1000000000000 then
    some { s with loan_count := s.loan_count + 1, qed_status := .Active }
  else none

def borrowTransition (s : State) (signer : Pubkey) (amount : Nat) (collateral : Nat) : Option State :=
  let borrower := signer
  if s.qed_status = .Active ∧ amount ≤ s.total_cash ∧ s.paused = 0 ∧ amount > 0 ∧ collateral > 0 ∧ s.total_cash ≥ amount ∧ s.total_borrows + amount ≤ 1000000000000 ∧ s.collateral_amount + collateral ≤ 1000000000000 then
    some { s with total_cash := s.total_cash - amount, total_borrows := s.total_borrows + amount, collateral_amount := s.collateral_amount + collateral, qed_status := .Active }
  else none

def repayTransition (s : State) (signer : Pubkey) (amount : Nat) (collateral : Nat) : Option State :=
  let borrower := signer
  if s.qed_status = .Active ∧ amount ≤ s.total_borrows ∧ collateral ≤ s.collateral_amount ∧ amount > 0 ∧ s.total_borrows ≥ amount ∧ s.collateral_amount ≥ collateral ∧ s.total_cash + amount ≤ 1000000000000 then
    some { s with total_cash := s.total_cash + amount, total_borrows := s.total_borrows - amount, collateral_amount := s.collateral_amount - collateral, qed_status := .Active }
  else none

def liquidateTransition (s : State) (signer : Pubkey) : Option State :=
  if s.qed_status = .Active ∧ s.total_borrows > 0 ∧ s.collateral_amount > 0 ∧ s.total_cash + s.total_borrows ≤ 1000000000000 ∧ s.total_cash + total_borrows ≤ 18446744073709551615 then
    some { s with total_cash := s.total_cash + total_borrows, total_borrows := 0, collateral_amount := 0, qed_status := .Active }
  else none

def create_agent_intentTransition (s : State) (signer : Pubkey) (nonce : Nat) : Option State :=
  let owner := signer
  if s.qed_status = .Active ∧ nonce = s.next_intent_nonce ∧ s.next_intent_nonce + 1 ≤ 1000000000000 then
    some { s with next_intent_nonce := s.next_intent_nonce + 1, consumed := 0, qed_status := .Active }
  else none

def execute_agent_intentTransition (s : State) (signer : Pubkey) : Option State :=
  let executor := signer
  if s.qed_status = .Active ∧ s.consumed = 0 then
    some { s with consumed := 1, qed_status := .Active }
  else none

def cancel_agent_intentTransition (s : State) (signer : Pubkey) : Option State :=
  let owner := signer
  if s.qed_status = .Active ∧ s.consumed = 0 then
    some { s with consumed := 1, qed_status := .Active }
  else none

inductive Operation where
  | initialize_protocol
  | initialize_market
  | initialize_position
  | pause
  | unpause
  | configure_strategy (enabled : Nat)
  | activate_strategy
  | cancel_strategy_change
  | propose_admin
  | accept_admin
  | deposit (side : Nat) (amount : Nat)
  | withdraw_unmatched (side : Nat) (amount : Nat)
  | match_positions (amount : Nat)
  | unmatch_positions (amount : Nat)
  | harvest_yield (amount : Nat)
  | claim_yield (amount : Nat)
  | resolve_market (winning_side : Nat)
  | update_price (observed_slot : Nat)
  | initialize_lending_pool
  | initialize_lender
  | fund_lending (amount : Nat)
  | withdraw_lending (shares : Nat)
  | initialize_loan
  | borrow (amount : Nat) (collateral : Nat)
  | repay (amount : Nat) (collateral : Nat)
  | liquidate
  | create_agent_intent (nonce : Nat)
  | execute_agent_intent
  | cancel_agent_intent
  deriving Repr, DecidableEq, BEq

def applyOp (s : State) (signer : Pubkey) : Operation → Option State
  | .initialize_protocol => initialize_protocolTransition s signer
  | .initialize_market => initialize_marketTransition s signer
  | .initialize_position => initialize_positionTransition s signer
  | .pause => pauseTransition s signer
  | .unpause => unpauseTransition s signer
  | .configure_strategy enabled => configure_strategyTransition s signer enabled
  | .activate_strategy => activate_strategyTransition s signer
  | .cancel_strategy_change => cancel_strategy_changeTransition s signer
  | .propose_admin => propose_adminTransition s signer
  | .accept_admin => accept_adminTransition s signer
  | .deposit side amount => depositTransition s signer side amount
  | .withdraw_unmatched side amount => withdraw_unmatchedTransition s signer side amount
  | .match_positions amount => match_positionsTransition s signer amount
  | .unmatch_positions amount => unmatch_positionsTransition s signer amount
  | .harvest_yield amount => harvest_yieldTransition s signer amount
  | .claim_yield amount => claim_yieldTransition s signer amount
  | .resolve_market winning_side => resolve_marketTransition s signer winning_side
  | .update_price observed_slot => update_priceTransition s signer observed_slot
  | .initialize_lending_pool => initialize_lending_poolTransition s signer
  | .initialize_lender => initialize_lenderTransition s signer
  | .fund_lending amount => fund_lendingTransition s signer amount
  | .withdraw_lending shares => withdraw_lendingTransition s signer shares
  | .initialize_loan => initialize_loanTransition s signer
  | .borrow amount collateral => borrowTransition s signer amount collateral
  | .repay amount collateral => repayTransition s signer amount collateral
  | .liquidate => liquidateTransition s signer
  | .create_agent_intent nonce => create_agent_intentTransition s signer nonce
  | .execute_agent_intent => execute_agent_intentTransition s signer
  | .cancel_agent_intent => cancel_agent_intentTransition s signer

def matched_pairs_are_backed (s : State) : Prop := s.matched_pairs ≤ s.total_yes ∧ s.matched_pairs ≤ s.total_no

theorem matched_pairs_are_backed_preserved_by_initialize_protocol (s s' : State) (signer : Pubkey)
    (h_inv : matched_pairs_are_backed s) (h : initialize_protocolTransition s signer = some s') :
    matched_pairs_are_backed s' := by
  unfold initialize_protocolTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_initialize_market (s s' : State) (signer : Pubkey)
    (h_inv : matched_pairs_are_backed s) (h : initialize_marketTransition s signer = some s') :
    matched_pairs_are_backed s' := by
  unfold initialize_marketTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_initialize_position (s s' : State) (signer : Pubkey)
    (h_inv : matched_pairs_are_backed s) (h : initialize_positionTransition s signer = some s') :
    matched_pairs_are_backed s' := by
  unfold initialize_positionTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_pause (s s' : State) (signer : Pubkey)
    (h_inv : matched_pairs_are_backed s) (h : pauseTransition s signer = some s') :
    matched_pairs_are_backed s' := by
  unfold pauseTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_unpause (s s' : State) (signer : Pubkey)
    (h_inv : matched_pairs_are_backed s) (h : unpauseTransition s signer = some s') :
    matched_pairs_are_backed s' := by
  unfold unpauseTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_configure_strategy (s s' : State) (signer : Pubkey) (enabled : Nat)
    (h_inv : matched_pairs_are_backed s) (h : configure_strategyTransition s signer enabled = some s') :
    matched_pairs_are_backed s' := by
  unfold configure_strategyTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_activate_strategy (s s' : State) (signer : Pubkey)
    (h_inv : matched_pairs_are_backed s) (h : activate_strategyTransition s signer = some s') :
    matched_pairs_are_backed s' := by
  unfold activate_strategyTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_cancel_strategy_change (s s' : State) (signer : Pubkey)
    (h_inv : matched_pairs_are_backed s) (h : cancel_strategy_changeTransition s signer = some s') :
    matched_pairs_are_backed s' := by
  unfold cancel_strategy_changeTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_propose_admin (s s' : State) (signer : Pubkey)
    (h_inv : matched_pairs_are_backed s) (h : propose_adminTransition s signer = some s') :
    matched_pairs_are_backed s' := by
  unfold propose_adminTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_accept_admin (s s' : State) (signer : Pubkey)
    (h_inv : matched_pairs_are_backed s) (h : accept_adminTransition s signer = some s') :
    matched_pairs_are_backed s' := by
  unfold accept_adminTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_deposit (s s' : State) (signer : Pubkey) (side : Nat) (amount : Nat)
    (h_inv : matched_pairs_are_backed s) (h : depositTransition s signer side amount = some s') :
    matched_pairs_are_backed s' := by
  unfold depositTransition at h; split at h
  · next hg => cases h; unfold matched_pairs_are_backed at h_inv ⊢; dsimp; omega
  · contradiction

theorem matched_pairs_are_backed_preserved_by_withdraw_unmatched (s s' : State) (signer : Pubkey) (side : Nat) (amount : Nat)
    (h_inv : matched_pairs_are_backed s) (h : withdraw_unmatchedTransition s signer side amount = some s') :
    matched_pairs_are_backed s' := by
  unfold withdraw_unmatchedTransition at h; split at h
  · next hg => cases h; unfold matched_pairs_are_backed at h_inv ⊢; dsimp; omega
  · contradiction

theorem matched_pairs_are_backed_preserved_by_match_positions (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : matched_pairs_are_backed s) (h : match_positionsTransition s signer amount = some s') :
    matched_pairs_are_backed s' := by
  unfold match_positionsTransition at h; split at h
  · next hg => cases h; unfold matched_pairs_are_backed at h_inv ⊢; dsimp; omega
  · contradiction

theorem matched_pairs_are_backed_preserved_by_unmatch_positions (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : matched_pairs_are_backed s) (h : unmatch_positionsTransition s signer amount = some s') :
    matched_pairs_are_backed s' := by
  unfold unmatch_positionsTransition at h; split at h
  · next hg => cases h; unfold matched_pairs_are_backed at h_inv ⊢; dsimp; omega
  · contradiction

theorem matched_pairs_are_backed_preserved_by_harvest_yield (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : matched_pairs_are_backed s) (h : harvest_yieldTransition s signer amount = some s') :
    matched_pairs_are_backed s' := by
  unfold harvest_yieldTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_claim_yield (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : matched_pairs_are_backed s) (h : claim_yieldTransition s signer amount = some s') :
    matched_pairs_are_backed s' := by
  unfold claim_yieldTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_resolve_market (s s' : State) (signer : Pubkey) (winning_side : Nat)
    (h_inv : matched_pairs_are_backed s) (h : resolve_marketTransition s signer winning_side = some s') :
    matched_pairs_are_backed s' := by
  unfold resolve_marketTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_update_price (s s' : State) (signer : Pubkey) (observed_slot : Nat)
    (h_inv : matched_pairs_are_backed s) (h : update_priceTransition s signer observed_slot = some s') :
    matched_pairs_are_backed s' := by
  unfold update_priceTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_initialize_lending_pool (s s' : State) (signer : Pubkey)
    (h_inv : matched_pairs_are_backed s) (h : initialize_lending_poolTransition s signer = some s') :
    matched_pairs_are_backed s' := by
  unfold initialize_lending_poolTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_initialize_lender (s s' : State) (signer : Pubkey)
    (h_inv : matched_pairs_are_backed s) (h : initialize_lenderTransition s signer = some s') :
    matched_pairs_are_backed s' := by
  unfold initialize_lenderTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_fund_lending (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : matched_pairs_are_backed s) (h : fund_lendingTransition s signer amount = some s') :
    matched_pairs_are_backed s' := by
  unfold fund_lendingTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_withdraw_lending (s s' : State) (signer : Pubkey) (shares : Nat)
    (h_inv : matched_pairs_are_backed s) (h : withdraw_lendingTransition s signer shares = some s') :
    matched_pairs_are_backed s' := by
  unfold withdraw_lendingTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_initialize_loan (s s' : State) (signer : Pubkey)
    (h_inv : matched_pairs_are_backed s) (h : initialize_loanTransition s signer = some s') :
    matched_pairs_are_backed s' := by
  unfold initialize_loanTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_borrow (s s' : State) (signer : Pubkey) (amount : Nat) (collateral : Nat)
    (h_inv : matched_pairs_are_backed s) (h : borrowTransition s signer amount collateral = some s') :
    matched_pairs_are_backed s' := by
  unfold borrowTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_repay (s s' : State) (signer : Pubkey) (amount : Nat) (collateral : Nat)
    (h_inv : matched_pairs_are_backed s) (h : repayTransition s signer amount collateral = some s') :
    matched_pairs_are_backed s' := by
  unfold repayTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_liquidate (s s' : State) (signer : Pubkey)
    (h_inv : matched_pairs_are_backed s) (h : liquidateTransition s signer = some s') :
    matched_pairs_are_backed s' := by
  unfold liquidateTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_create_agent_intent (s s' : State) (signer : Pubkey) (nonce : Nat)
    (h_inv : matched_pairs_are_backed s) (h : create_agent_intentTransition s signer nonce = some s') :
    matched_pairs_are_backed s' := by
  unfold create_agent_intentTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_execute_agent_intent (s s' : State) (signer : Pubkey)
    (h_inv : matched_pairs_are_backed s) (h : execute_agent_intentTransition s signer = some s') :
    matched_pairs_are_backed s' := by
  unfold execute_agent_intentTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem matched_pairs_are_backed_preserved_by_cancel_agent_intent (s s' : State) (signer : Pubkey)
    (h_inv : matched_pairs_are_backed s) (h : cancel_agent_intentTransition s signer = some s') :
    matched_pairs_are_backed s' := by
  unfold cancel_agent_intentTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

/-- matched_pairs_are_backed is preserved by every operation. Auto-proven by case split. -/
theorem matched_pairs_are_backed_inductive (s s' : State) (signer : Pubkey) (op : Operation)
    (h_inv : matched_pairs_are_backed s) (h : applyOp s signer op = some s') : matched_pairs_are_backed s' := by
  cases op with
  | initialize_protocol => exact matched_pairs_are_backed_preserved_by_initialize_protocol s s' signer h_inv h
  | initialize_market => exact matched_pairs_are_backed_preserved_by_initialize_market s s' signer h_inv h
  | initialize_position => exact matched_pairs_are_backed_preserved_by_initialize_position s s' signer h_inv h
  | pause => exact matched_pairs_are_backed_preserved_by_pause s s' signer h_inv h
  | unpause => exact matched_pairs_are_backed_preserved_by_unpause s s' signer h_inv h
  | configure_strategy enabled => exact matched_pairs_are_backed_preserved_by_configure_strategy s s' signer enabled h_inv h
  | activate_strategy => exact matched_pairs_are_backed_preserved_by_activate_strategy s s' signer h_inv h
  | cancel_strategy_change => exact matched_pairs_are_backed_preserved_by_cancel_strategy_change s s' signer h_inv h
  | propose_admin => exact matched_pairs_are_backed_preserved_by_propose_admin s s' signer h_inv h
  | accept_admin => exact matched_pairs_are_backed_preserved_by_accept_admin s s' signer h_inv h
  | deposit side amount => exact matched_pairs_are_backed_preserved_by_deposit s s' signer side amount h_inv h
  | withdraw_unmatched side amount => exact matched_pairs_are_backed_preserved_by_withdraw_unmatched s s' signer side amount h_inv h
  | match_positions amount => exact matched_pairs_are_backed_preserved_by_match_positions s s' signer amount h_inv h
  | unmatch_positions amount => exact matched_pairs_are_backed_preserved_by_unmatch_positions s s' signer amount h_inv h
  | harvest_yield amount => exact matched_pairs_are_backed_preserved_by_harvest_yield s s' signer amount h_inv h
  | claim_yield amount => exact matched_pairs_are_backed_preserved_by_claim_yield s s' signer amount h_inv h
  | resolve_market winning_side => exact matched_pairs_are_backed_preserved_by_resolve_market s s' signer winning_side h_inv h
  | update_price observed_slot => exact matched_pairs_are_backed_preserved_by_update_price s s' signer observed_slot h_inv h
  | initialize_lending_pool => exact matched_pairs_are_backed_preserved_by_initialize_lending_pool s s' signer h_inv h
  | initialize_lender => exact matched_pairs_are_backed_preserved_by_initialize_lender s s' signer h_inv h
  | fund_lending amount => exact matched_pairs_are_backed_preserved_by_fund_lending s s' signer amount h_inv h
  | withdraw_lending shares => exact matched_pairs_are_backed_preserved_by_withdraw_lending s s' signer shares h_inv h
  | initialize_loan => exact matched_pairs_are_backed_preserved_by_initialize_loan s s' signer h_inv h
  | borrow amount collateral => exact matched_pairs_are_backed_preserved_by_borrow s s' signer amount collateral h_inv h
  | repay amount collateral => exact matched_pairs_are_backed_preserved_by_repay s s' signer amount collateral h_inv h
  | liquidate => exact matched_pairs_are_backed_preserved_by_liquidate s s' signer h_inv h
  | create_agent_intent nonce => exact matched_pairs_are_backed_preserved_by_create_agent_intent s s' signer nonce h_inv h
  | execute_agent_intent => exact matched_pairs_are_backed_preserved_by_execute_agent_intent s s' signer h_inv h
  | cancel_agent_intent => exact matched_pairs_are_backed_preserved_by_cancel_agent_intent s s' signer h_inv h

def strategy_is_pair_backed (s : State) : Prop := s.strategy_principal ≤ s.matched_pairs

theorem strategy_is_pair_backed_preserved_by_initialize_protocol (s s' : State) (signer : Pubkey)
    (h_inv : strategy_is_pair_backed s) (h : initialize_protocolTransition s signer = some s') :
    strategy_is_pair_backed s' := by
  unfold initialize_protocolTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_initialize_market (s s' : State) (signer : Pubkey)
    (h_inv : strategy_is_pair_backed s) (h : initialize_marketTransition s signer = some s') :
    strategy_is_pair_backed s' := by
  unfold initialize_marketTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_initialize_position (s s' : State) (signer : Pubkey)
    (h_inv : strategy_is_pair_backed s) (h : initialize_positionTransition s signer = some s') :
    strategy_is_pair_backed s' := by
  unfold initialize_positionTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_pause (s s' : State) (signer : Pubkey)
    (h_inv : strategy_is_pair_backed s) (h : pauseTransition s signer = some s') :
    strategy_is_pair_backed s' := by
  unfold pauseTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_unpause (s s' : State) (signer : Pubkey)
    (h_inv : strategy_is_pair_backed s) (h : unpauseTransition s signer = some s') :
    strategy_is_pair_backed s' := by
  unfold unpauseTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_configure_strategy (s s' : State) (signer : Pubkey) (enabled : Nat)
    (h_inv : strategy_is_pair_backed s) (h : configure_strategyTransition s signer enabled = some s') :
    strategy_is_pair_backed s' := by
  unfold configure_strategyTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_activate_strategy (s s' : State) (signer : Pubkey)
    (h_inv : strategy_is_pair_backed s) (h : activate_strategyTransition s signer = some s') :
    strategy_is_pair_backed s' := by
  unfold activate_strategyTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_cancel_strategy_change (s s' : State) (signer : Pubkey)
    (h_inv : strategy_is_pair_backed s) (h : cancel_strategy_changeTransition s signer = some s') :
    strategy_is_pair_backed s' := by
  unfold cancel_strategy_changeTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_propose_admin (s s' : State) (signer : Pubkey)
    (h_inv : strategy_is_pair_backed s) (h : propose_adminTransition s signer = some s') :
    strategy_is_pair_backed s' := by
  unfold propose_adminTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_accept_admin (s s' : State) (signer : Pubkey)
    (h_inv : strategy_is_pair_backed s) (h : accept_adminTransition s signer = some s') :
    strategy_is_pair_backed s' := by
  unfold accept_adminTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_deposit (s s' : State) (signer : Pubkey) (side : Nat) (amount : Nat)
    (h_inv : strategy_is_pair_backed s) (h : depositTransition s signer side amount = some s') :
    strategy_is_pair_backed s' := by
  unfold depositTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_withdraw_unmatched (s s' : State) (signer : Pubkey) (side : Nat) (amount : Nat)
    (h_inv : strategy_is_pair_backed s) (h : withdraw_unmatchedTransition s signer side amount = some s') :
    strategy_is_pair_backed s' := by
  unfold withdraw_unmatchedTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_match_positions (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : strategy_is_pair_backed s) (h : match_positionsTransition s signer amount = some s') :
    strategy_is_pair_backed s' := by
  unfold match_positionsTransition at h; split at h
  · next hg => cases h; unfold strategy_is_pair_backed at h_inv ⊢; dsimp; omega
  · contradiction

theorem strategy_is_pair_backed_preserved_by_unmatch_positions (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : strategy_is_pair_backed s) (h : unmatch_positionsTransition s signer amount = some s') :
    strategy_is_pair_backed s' := by
  unfold unmatch_positionsTransition at h; split at h
  · next hg => cases h; unfold strategy_is_pair_backed at h_inv ⊢; dsimp; omega
  · contradiction

theorem strategy_is_pair_backed_preserved_by_harvest_yield (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : strategy_is_pair_backed s) (h : harvest_yieldTransition s signer amount = some s') :
    strategy_is_pair_backed s' := by
  unfold harvest_yieldTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_claim_yield (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : strategy_is_pair_backed s) (h : claim_yieldTransition s signer amount = some s') :
    strategy_is_pair_backed s' := by
  unfold claim_yieldTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_resolve_market (s s' : State) (signer : Pubkey) (winning_side : Nat)
    (h_inv : strategy_is_pair_backed s) (h : resolve_marketTransition s signer winning_side = some s') :
    strategy_is_pair_backed s' := by
  unfold resolve_marketTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_update_price (s s' : State) (signer : Pubkey) (observed_slot : Nat)
    (h_inv : strategy_is_pair_backed s) (h : update_priceTransition s signer observed_slot = some s') :
    strategy_is_pair_backed s' := by
  unfold update_priceTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_initialize_lending_pool (s s' : State) (signer : Pubkey)
    (h_inv : strategy_is_pair_backed s) (h : initialize_lending_poolTransition s signer = some s') :
    strategy_is_pair_backed s' := by
  unfold initialize_lending_poolTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_initialize_lender (s s' : State) (signer : Pubkey)
    (h_inv : strategy_is_pair_backed s) (h : initialize_lenderTransition s signer = some s') :
    strategy_is_pair_backed s' := by
  unfold initialize_lenderTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_fund_lending (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : strategy_is_pair_backed s) (h : fund_lendingTransition s signer amount = some s') :
    strategy_is_pair_backed s' := by
  unfold fund_lendingTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_withdraw_lending (s s' : State) (signer : Pubkey) (shares : Nat)
    (h_inv : strategy_is_pair_backed s) (h : withdraw_lendingTransition s signer shares = some s') :
    strategy_is_pair_backed s' := by
  unfold withdraw_lendingTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_initialize_loan (s s' : State) (signer : Pubkey)
    (h_inv : strategy_is_pair_backed s) (h : initialize_loanTransition s signer = some s') :
    strategy_is_pair_backed s' := by
  unfold initialize_loanTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_borrow (s s' : State) (signer : Pubkey) (amount : Nat) (collateral : Nat)
    (h_inv : strategy_is_pair_backed s) (h : borrowTransition s signer amount collateral = some s') :
    strategy_is_pair_backed s' := by
  unfold borrowTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_repay (s s' : State) (signer : Pubkey) (amount : Nat) (collateral : Nat)
    (h_inv : strategy_is_pair_backed s) (h : repayTransition s signer amount collateral = some s') :
    strategy_is_pair_backed s' := by
  unfold repayTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_liquidate (s s' : State) (signer : Pubkey)
    (h_inv : strategy_is_pair_backed s) (h : liquidateTransition s signer = some s') :
    strategy_is_pair_backed s' := by
  unfold liquidateTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_create_agent_intent (s s' : State) (signer : Pubkey) (nonce : Nat)
    (h_inv : strategy_is_pair_backed s) (h : create_agent_intentTransition s signer nonce = some s') :
    strategy_is_pair_backed s' := by
  unfold create_agent_intentTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_execute_agent_intent (s s' : State) (signer : Pubkey)
    (h_inv : strategy_is_pair_backed s) (h : execute_agent_intentTransition s signer = some s') :
    strategy_is_pair_backed s' := by
  unfold execute_agent_intentTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem strategy_is_pair_backed_preserved_by_cancel_agent_intent (s s' : State) (signer : Pubkey)
    (h_inv : strategy_is_pair_backed s) (h : cancel_agent_intentTransition s signer = some s') :
    strategy_is_pair_backed s' := by
  unfold cancel_agent_intentTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

/-- strategy_is_pair_backed is preserved by every operation. Auto-proven by case split. -/
theorem strategy_is_pair_backed_inductive (s s' : State) (signer : Pubkey) (op : Operation)
    (h_inv : strategy_is_pair_backed s) (h : applyOp s signer op = some s') : strategy_is_pair_backed s' := by
  cases op with
  | initialize_protocol => exact strategy_is_pair_backed_preserved_by_initialize_protocol s s' signer h_inv h
  | initialize_market => exact strategy_is_pair_backed_preserved_by_initialize_market s s' signer h_inv h
  | initialize_position => exact strategy_is_pair_backed_preserved_by_initialize_position s s' signer h_inv h
  | pause => exact strategy_is_pair_backed_preserved_by_pause s s' signer h_inv h
  | unpause => exact strategy_is_pair_backed_preserved_by_unpause s s' signer h_inv h
  | configure_strategy enabled => exact strategy_is_pair_backed_preserved_by_configure_strategy s s' signer enabled h_inv h
  | activate_strategy => exact strategy_is_pair_backed_preserved_by_activate_strategy s s' signer h_inv h
  | cancel_strategy_change => exact strategy_is_pair_backed_preserved_by_cancel_strategy_change s s' signer h_inv h
  | propose_admin => exact strategy_is_pair_backed_preserved_by_propose_admin s s' signer h_inv h
  | accept_admin => exact strategy_is_pair_backed_preserved_by_accept_admin s s' signer h_inv h
  | deposit side amount => exact strategy_is_pair_backed_preserved_by_deposit s s' signer side amount h_inv h
  | withdraw_unmatched side amount => exact strategy_is_pair_backed_preserved_by_withdraw_unmatched s s' signer side amount h_inv h
  | match_positions amount => exact strategy_is_pair_backed_preserved_by_match_positions s s' signer amount h_inv h
  | unmatch_positions amount => exact strategy_is_pair_backed_preserved_by_unmatch_positions s s' signer amount h_inv h
  | harvest_yield amount => exact strategy_is_pair_backed_preserved_by_harvest_yield s s' signer amount h_inv h
  | claim_yield amount => exact strategy_is_pair_backed_preserved_by_claim_yield s s' signer amount h_inv h
  | resolve_market winning_side => exact strategy_is_pair_backed_preserved_by_resolve_market s s' signer winning_side h_inv h
  | update_price observed_slot => exact strategy_is_pair_backed_preserved_by_update_price s s' signer observed_slot h_inv h
  | initialize_lending_pool => exact strategy_is_pair_backed_preserved_by_initialize_lending_pool s s' signer h_inv h
  | initialize_lender => exact strategy_is_pair_backed_preserved_by_initialize_lender s s' signer h_inv h
  | fund_lending amount => exact strategy_is_pair_backed_preserved_by_fund_lending s s' signer amount h_inv h
  | withdraw_lending shares => exact strategy_is_pair_backed_preserved_by_withdraw_lending s s' signer shares h_inv h
  | initialize_loan => exact strategy_is_pair_backed_preserved_by_initialize_loan s s' signer h_inv h
  | borrow amount collateral => exact strategy_is_pair_backed_preserved_by_borrow s s' signer amount collateral h_inv h
  | repay amount collateral => exact strategy_is_pair_backed_preserved_by_repay s s' signer amount collateral h_inv h
  | liquidate => exact strategy_is_pair_backed_preserved_by_liquidate s s' signer h_inv h
  | create_agent_intent nonce => exact strategy_is_pair_backed_preserved_by_create_agent_intent s s' signer nonce h_inv h
  | execute_agent_intent => exact strategy_is_pair_backed_preserved_by_execute_agent_intent s s' signer h_inv h
  | cancel_agent_intent => exact strategy_is_pair_backed_preserved_by_cancel_agent_intent s s' signer h_inv h

def yield_cannot_be_overclaimed (s : State) : Prop := s.claimed_yield ≤ s.harvested_yield

theorem yield_cannot_be_overclaimed_preserved_by_initialize_protocol (s s' : State) (signer : Pubkey)
    (h_inv : yield_cannot_be_overclaimed s) (h : initialize_protocolTransition s signer = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold initialize_protocolTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_initialize_market (s s' : State) (signer : Pubkey)
    (h_inv : yield_cannot_be_overclaimed s) (h : initialize_marketTransition s signer = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold initialize_marketTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_initialize_position (s s' : State) (signer : Pubkey)
    (h_inv : yield_cannot_be_overclaimed s) (h : initialize_positionTransition s signer = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold initialize_positionTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_pause (s s' : State) (signer : Pubkey)
    (h_inv : yield_cannot_be_overclaimed s) (h : pauseTransition s signer = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold pauseTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_unpause (s s' : State) (signer : Pubkey)
    (h_inv : yield_cannot_be_overclaimed s) (h : unpauseTransition s signer = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold unpauseTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_configure_strategy (s s' : State) (signer : Pubkey) (enabled : Nat)
    (h_inv : yield_cannot_be_overclaimed s) (h : configure_strategyTransition s signer enabled = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold configure_strategyTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_activate_strategy (s s' : State) (signer : Pubkey)
    (h_inv : yield_cannot_be_overclaimed s) (h : activate_strategyTransition s signer = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold activate_strategyTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_cancel_strategy_change (s s' : State) (signer : Pubkey)
    (h_inv : yield_cannot_be_overclaimed s) (h : cancel_strategy_changeTransition s signer = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold cancel_strategy_changeTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_propose_admin (s s' : State) (signer : Pubkey)
    (h_inv : yield_cannot_be_overclaimed s) (h : propose_adminTransition s signer = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold propose_adminTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_accept_admin (s s' : State) (signer : Pubkey)
    (h_inv : yield_cannot_be_overclaimed s) (h : accept_adminTransition s signer = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold accept_adminTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_deposit (s s' : State) (signer : Pubkey) (side : Nat) (amount : Nat)
    (h_inv : yield_cannot_be_overclaimed s) (h : depositTransition s signer side amount = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold depositTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_withdraw_unmatched (s s' : State) (signer : Pubkey) (side : Nat) (amount : Nat)
    (h_inv : yield_cannot_be_overclaimed s) (h : withdraw_unmatchedTransition s signer side amount = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold withdraw_unmatchedTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_match_positions (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : yield_cannot_be_overclaimed s) (h : match_positionsTransition s signer amount = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold match_positionsTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_unmatch_positions (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : yield_cannot_be_overclaimed s) (h : unmatch_positionsTransition s signer amount = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold unmatch_positionsTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_harvest_yield (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : yield_cannot_be_overclaimed s) (h : harvest_yieldTransition s signer amount = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold harvest_yieldTransition at h; split at h
  · next hg => cases h; unfold yield_cannot_be_overclaimed at h_inv ⊢; dsimp; omega
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_claim_yield (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : yield_cannot_be_overclaimed s) (h : claim_yieldTransition s signer amount = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold claim_yieldTransition at h; split at h
  · next hg => cases h; unfold yield_cannot_be_overclaimed at h_inv ⊢; dsimp; omega
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_resolve_market (s s' : State) (signer : Pubkey) (winning_side : Nat)
    (h_inv : yield_cannot_be_overclaimed s) (h : resolve_marketTransition s signer winning_side = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold resolve_marketTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_update_price (s s' : State) (signer : Pubkey) (observed_slot : Nat)
    (h_inv : yield_cannot_be_overclaimed s) (h : update_priceTransition s signer observed_slot = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold update_priceTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_initialize_lending_pool (s s' : State) (signer : Pubkey)
    (h_inv : yield_cannot_be_overclaimed s) (h : initialize_lending_poolTransition s signer = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold initialize_lending_poolTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_initialize_lender (s s' : State) (signer : Pubkey)
    (h_inv : yield_cannot_be_overclaimed s) (h : initialize_lenderTransition s signer = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold initialize_lenderTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_fund_lending (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : yield_cannot_be_overclaimed s) (h : fund_lendingTransition s signer amount = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold fund_lendingTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_withdraw_lending (s s' : State) (signer : Pubkey) (shares : Nat)
    (h_inv : yield_cannot_be_overclaimed s) (h : withdraw_lendingTransition s signer shares = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold withdraw_lendingTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_initialize_loan (s s' : State) (signer : Pubkey)
    (h_inv : yield_cannot_be_overclaimed s) (h : initialize_loanTransition s signer = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold initialize_loanTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_borrow (s s' : State) (signer : Pubkey) (amount : Nat) (collateral : Nat)
    (h_inv : yield_cannot_be_overclaimed s) (h : borrowTransition s signer amount collateral = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold borrowTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_repay (s s' : State) (signer : Pubkey) (amount : Nat) (collateral : Nat)
    (h_inv : yield_cannot_be_overclaimed s) (h : repayTransition s signer amount collateral = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold repayTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_liquidate (s s' : State) (signer : Pubkey)
    (h_inv : yield_cannot_be_overclaimed s) (h : liquidateTransition s signer = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold liquidateTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_create_agent_intent (s s' : State) (signer : Pubkey) (nonce : Nat)
    (h_inv : yield_cannot_be_overclaimed s) (h : create_agent_intentTransition s signer nonce = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold create_agent_intentTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_execute_agent_intent (s s' : State) (signer : Pubkey)
    (h_inv : yield_cannot_be_overclaimed s) (h : execute_agent_intentTransition s signer = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold execute_agent_intentTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem yield_cannot_be_overclaimed_preserved_by_cancel_agent_intent (s s' : State) (signer : Pubkey)
    (h_inv : yield_cannot_be_overclaimed s) (h : cancel_agent_intentTransition s signer = some s') :
    yield_cannot_be_overclaimed s' := by
  unfold cancel_agent_intentTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

/-- yield_cannot_be_overclaimed is preserved by every operation. Auto-proven by case split. -/
theorem yield_cannot_be_overclaimed_inductive (s s' : State) (signer : Pubkey) (op : Operation)
    (h_inv : yield_cannot_be_overclaimed s) (h : applyOp s signer op = some s') : yield_cannot_be_overclaimed s' := by
  cases op with
  | initialize_protocol => exact yield_cannot_be_overclaimed_preserved_by_initialize_protocol s s' signer h_inv h
  | initialize_market => exact yield_cannot_be_overclaimed_preserved_by_initialize_market s s' signer h_inv h
  | initialize_position => exact yield_cannot_be_overclaimed_preserved_by_initialize_position s s' signer h_inv h
  | pause => exact yield_cannot_be_overclaimed_preserved_by_pause s s' signer h_inv h
  | unpause => exact yield_cannot_be_overclaimed_preserved_by_unpause s s' signer h_inv h
  | configure_strategy enabled => exact yield_cannot_be_overclaimed_preserved_by_configure_strategy s s' signer enabled h_inv h
  | activate_strategy => exact yield_cannot_be_overclaimed_preserved_by_activate_strategy s s' signer h_inv h
  | cancel_strategy_change => exact yield_cannot_be_overclaimed_preserved_by_cancel_strategy_change s s' signer h_inv h
  | propose_admin => exact yield_cannot_be_overclaimed_preserved_by_propose_admin s s' signer h_inv h
  | accept_admin => exact yield_cannot_be_overclaimed_preserved_by_accept_admin s s' signer h_inv h
  | deposit side amount => exact yield_cannot_be_overclaimed_preserved_by_deposit s s' signer side amount h_inv h
  | withdraw_unmatched side amount => exact yield_cannot_be_overclaimed_preserved_by_withdraw_unmatched s s' signer side amount h_inv h
  | match_positions amount => exact yield_cannot_be_overclaimed_preserved_by_match_positions s s' signer amount h_inv h
  | unmatch_positions amount => exact yield_cannot_be_overclaimed_preserved_by_unmatch_positions s s' signer amount h_inv h
  | harvest_yield amount => exact yield_cannot_be_overclaimed_preserved_by_harvest_yield s s' signer amount h_inv h
  | claim_yield amount => exact yield_cannot_be_overclaimed_preserved_by_claim_yield s s' signer amount h_inv h
  | resolve_market winning_side => exact yield_cannot_be_overclaimed_preserved_by_resolve_market s s' signer winning_side h_inv h
  | update_price observed_slot => exact yield_cannot_be_overclaimed_preserved_by_update_price s s' signer observed_slot h_inv h
  | initialize_lending_pool => exact yield_cannot_be_overclaimed_preserved_by_initialize_lending_pool s s' signer h_inv h
  | initialize_lender => exact yield_cannot_be_overclaimed_preserved_by_initialize_lender s s' signer h_inv h
  | fund_lending amount => exact yield_cannot_be_overclaimed_preserved_by_fund_lending s s' signer amount h_inv h
  | withdraw_lending shares => exact yield_cannot_be_overclaimed_preserved_by_withdraw_lending s s' signer shares h_inv h
  | initialize_loan => exact yield_cannot_be_overclaimed_preserved_by_initialize_loan s s' signer h_inv h
  | borrow amount collateral => exact yield_cannot_be_overclaimed_preserved_by_borrow s s' signer amount collateral h_inv h
  | repay amount collateral => exact yield_cannot_be_overclaimed_preserved_by_repay s s' signer amount collateral h_inv h
  | liquidate => exact yield_cannot_be_overclaimed_preserved_by_liquidate s s' signer h_inv h
  | create_agent_intent nonce => exact yield_cannot_be_overclaimed_preserved_by_create_agent_intent s s' signer nonce h_inv h
  | execute_agent_intent => exact yield_cannot_be_overclaimed_preserved_by_execute_agent_intent s s' signer h_inv h
  | cancel_agent_intent => exact yield_cannot_be_overclaimed_preserved_by_cancel_agent_intent s s' signer h_inv h

def lending_is_conserved (s : State) : Prop := s.total_cash + s.total_borrows + s.bad_debt ≥ s.total_lender_shares

theorem lending_is_conserved_preserved_by_initialize_protocol (s s' : State) (signer : Pubkey)
    (h_inv : lending_is_conserved s) (h : initialize_protocolTransition s signer = some s') :
    lending_is_conserved s' := by
  unfold initialize_protocolTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_initialize_market (s s' : State) (signer : Pubkey)
    (h_inv : lending_is_conserved s) (h : initialize_marketTransition s signer = some s') :
    lending_is_conserved s' := by
  unfold initialize_marketTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_initialize_position (s s' : State) (signer : Pubkey)
    (h_inv : lending_is_conserved s) (h : initialize_positionTransition s signer = some s') :
    lending_is_conserved s' := by
  unfold initialize_positionTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_pause (s s' : State) (signer : Pubkey)
    (h_inv : lending_is_conserved s) (h : pauseTransition s signer = some s') :
    lending_is_conserved s' := by
  unfold pauseTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_unpause (s s' : State) (signer : Pubkey)
    (h_inv : lending_is_conserved s) (h : unpauseTransition s signer = some s') :
    lending_is_conserved s' := by
  unfold unpauseTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_configure_strategy (s s' : State) (signer : Pubkey) (enabled : Nat)
    (h_inv : lending_is_conserved s) (h : configure_strategyTransition s signer enabled = some s') :
    lending_is_conserved s' := by
  unfold configure_strategyTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_activate_strategy (s s' : State) (signer : Pubkey)
    (h_inv : lending_is_conserved s) (h : activate_strategyTransition s signer = some s') :
    lending_is_conserved s' := by
  unfold activate_strategyTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_cancel_strategy_change (s s' : State) (signer : Pubkey)
    (h_inv : lending_is_conserved s) (h : cancel_strategy_changeTransition s signer = some s') :
    lending_is_conserved s' := by
  unfold cancel_strategy_changeTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_propose_admin (s s' : State) (signer : Pubkey)
    (h_inv : lending_is_conserved s) (h : propose_adminTransition s signer = some s') :
    lending_is_conserved s' := by
  unfold propose_adminTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_accept_admin (s s' : State) (signer : Pubkey)
    (h_inv : lending_is_conserved s) (h : accept_adminTransition s signer = some s') :
    lending_is_conserved s' := by
  unfold accept_adminTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_deposit (s s' : State) (signer : Pubkey) (side : Nat) (amount : Nat)
    (h_inv : lending_is_conserved s) (h : depositTransition s signer side amount = some s') :
    lending_is_conserved s' := by
  unfold depositTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_withdraw_unmatched (s s' : State) (signer : Pubkey) (side : Nat) (amount : Nat)
    (h_inv : lending_is_conserved s) (h : withdraw_unmatchedTransition s signer side amount = some s') :
    lending_is_conserved s' := by
  unfold withdraw_unmatchedTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_match_positions (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : lending_is_conserved s) (h : match_positionsTransition s signer amount = some s') :
    lending_is_conserved s' := by
  unfold match_positionsTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_unmatch_positions (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : lending_is_conserved s) (h : unmatch_positionsTransition s signer amount = some s') :
    lending_is_conserved s' := by
  unfold unmatch_positionsTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_harvest_yield (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : lending_is_conserved s) (h : harvest_yieldTransition s signer amount = some s') :
    lending_is_conserved s' := by
  unfold harvest_yieldTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_claim_yield (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : lending_is_conserved s) (h : claim_yieldTransition s signer amount = some s') :
    lending_is_conserved s' := by
  unfold claim_yieldTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_resolve_market (s s' : State) (signer : Pubkey) (winning_side : Nat)
    (h_inv : lending_is_conserved s) (h : resolve_marketTransition s signer winning_side = some s') :
    lending_is_conserved s' := by
  unfold resolve_marketTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_update_price (s s' : State) (signer : Pubkey) (observed_slot : Nat)
    (h_inv : lending_is_conserved s) (h : update_priceTransition s signer observed_slot = some s') :
    lending_is_conserved s' := by
  unfold update_priceTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_initialize_lending_pool (s s' : State) (signer : Pubkey)
    (h_inv : lending_is_conserved s) (h : initialize_lending_poolTransition s signer = some s') :
    lending_is_conserved s' := by
  unfold initialize_lending_poolTransition at h; split at h
  · next hg => cases h; unfold lending_is_conserved at h_inv ⊢; dsimp; omega
  · contradiction

theorem lending_is_conserved_preserved_by_initialize_lender (s s' : State) (signer : Pubkey)
    (h_inv : lending_is_conserved s) (h : initialize_lenderTransition s signer = some s') :
    lending_is_conserved s' := by
  unfold initialize_lenderTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_fund_lending (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : lending_is_conserved s) (h : fund_lendingTransition s signer amount = some s') :
    lending_is_conserved s' := by
  unfold fund_lendingTransition at h; split at h
  · next hg => cases h; unfold lending_is_conserved at h_inv ⊢; dsimp; omega
  · contradiction

theorem lending_is_conserved_preserved_by_withdraw_lending (s s' : State) (signer : Pubkey) (shares : Nat)
    (h_inv : lending_is_conserved s) (h : withdraw_lendingTransition s signer shares = some s') :
    lending_is_conserved s' := by
  unfold withdraw_lendingTransition at h; split at h
  · next hg => cases h; unfold lending_is_conserved at h_inv ⊢; dsimp; omega
  · contradiction

theorem lending_is_conserved_preserved_by_initialize_loan (s s' : State) (signer : Pubkey)
    (h_inv : lending_is_conserved s) (h : initialize_loanTransition s signer = some s') :
    lending_is_conserved s' := by
  unfold initialize_loanTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_borrow (s s' : State) (signer : Pubkey) (amount : Nat) (collateral : Nat)
    (h_inv : lending_is_conserved s) (h : borrowTransition s signer amount collateral = some s') :
    lending_is_conserved s' := by
  unfold borrowTransition at h; split at h
  · next hg => cases h; unfold lending_is_conserved at h_inv ⊢; dsimp; omega
  · contradiction

theorem lending_is_conserved_preserved_by_repay (s s' : State) (signer : Pubkey) (amount : Nat) (collateral : Nat)
    (h_inv : lending_is_conserved s) (h : repayTransition s signer amount collateral = some s') :
    lending_is_conserved s' := by
  unfold repayTransition at h; split at h
  · next hg => cases h; unfold lending_is_conserved at h_inv ⊢; dsimp; omega
  · contradiction

theorem lending_is_conserved_preserved_by_liquidate (s s' : State) (signer : Pubkey)
    (h_inv : lending_is_conserved s) (h : liquidateTransition s signer = some s') :
    lending_is_conserved s' := by
  unfold liquidateTransition at h; split at h
  · next hg => cases h; unfold lending_is_conserved at h_inv ⊢; dsimp; omega
  · contradiction

theorem lending_is_conserved_preserved_by_create_agent_intent (s s' : State) (signer : Pubkey) (nonce : Nat)
    (h_inv : lending_is_conserved s) (h : create_agent_intentTransition s signer nonce = some s') :
    lending_is_conserved s' := by
  unfold create_agent_intentTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_execute_agent_intent (s s' : State) (signer : Pubkey)
    (h_inv : lending_is_conserved s) (h : execute_agent_intentTransition s signer = some s') :
    lending_is_conserved s' := by
  unfold execute_agent_intentTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem lending_is_conserved_preserved_by_cancel_agent_intent (s s' : State) (signer : Pubkey)
    (h_inv : lending_is_conserved s) (h : cancel_agent_intentTransition s signer = some s') :
    lending_is_conserved s' := by
  unfold cancel_agent_intentTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

/-- lending_is_conserved is preserved by every operation. Auto-proven by case split. -/
theorem lending_is_conserved_inductive (s s' : State) (signer : Pubkey) (op : Operation)
    (h_inv : lending_is_conserved s) (h : applyOp s signer op = some s') : lending_is_conserved s' := by
  cases op with
  | initialize_protocol => exact lending_is_conserved_preserved_by_initialize_protocol s s' signer h_inv h
  | initialize_market => exact lending_is_conserved_preserved_by_initialize_market s s' signer h_inv h
  | initialize_position => exact lending_is_conserved_preserved_by_initialize_position s s' signer h_inv h
  | pause => exact lending_is_conserved_preserved_by_pause s s' signer h_inv h
  | unpause => exact lending_is_conserved_preserved_by_unpause s s' signer h_inv h
  | configure_strategy enabled => exact lending_is_conserved_preserved_by_configure_strategy s s' signer enabled h_inv h
  | activate_strategy => exact lending_is_conserved_preserved_by_activate_strategy s s' signer h_inv h
  | cancel_strategy_change => exact lending_is_conserved_preserved_by_cancel_strategy_change s s' signer h_inv h
  | propose_admin => exact lending_is_conserved_preserved_by_propose_admin s s' signer h_inv h
  | accept_admin => exact lending_is_conserved_preserved_by_accept_admin s s' signer h_inv h
  | deposit side amount => exact lending_is_conserved_preserved_by_deposit s s' signer side amount h_inv h
  | withdraw_unmatched side amount => exact lending_is_conserved_preserved_by_withdraw_unmatched s s' signer side amount h_inv h
  | match_positions amount => exact lending_is_conserved_preserved_by_match_positions s s' signer amount h_inv h
  | unmatch_positions amount => exact lending_is_conserved_preserved_by_unmatch_positions s s' signer amount h_inv h
  | harvest_yield amount => exact lending_is_conserved_preserved_by_harvest_yield s s' signer amount h_inv h
  | claim_yield amount => exact lending_is_conserved_preserved_by_claim_yield s s' signer amount h_inv h
  | resolve_market winning_side => exact lending_is_conserved_preserved_by_resolve_market s s' signer winning_side h_inv h
  | update_price observed_slot => exact lending_is_conserved_preserved_by_update_price s s' signer observed_slot h_inv h
  | initialize_lending_pool => exact lending_is_conserved_preserved_by_initialize_lending_pool s s' signer h_inv h
  | initialize_lender => exact lending_is_conserved_preserved_by_initialize_lender s s' signer h_inv h
  | fund_lending amount => exact lending_is_conserved_preserved_by_fund_lending s s' signer amount h_inv h
  | withdraw_lending shares => exact lending_is_conserved_preserved_by_withdraw_lending s s' signer shares h_inv h
  | initialize_loan => exact lending_is_conserved_preserved_by_initialize_loan s s' signer h_inv h
  | borrow amount collateral => exact lending_is_conserved_preserved_by_borrow s s' signer amount collateral h_inv h
  | repay amount collateral => exact lending_is_conserved_preserved_by_repay s s' signer amount collateral h_inv h
  | liquidate => exact lending_is_conserved_preserved_by_liquidate s s' signer h_inv h
  | create_agent_intent nonce => exact lending_is_conserved_preserved_by_create_agent_intent s s' signer nonce h_inv h
  | execute_agent_intent => exact lending_is_conserved_preserved_by_execute_agent_intent s s' signer h_inv h
  | cancel_agent_intent => exact lending_is_conserved_preserved_by_cancel_agent_intent s s' signer h_inv h

def agent_nonce_is_monotonic (s : State) : Prop := s'.next_intent_nonce ≥ s.next_intent_nonce

theorem agent_nonce_is_monotonic_preserved_by_initialize_protocol (s s' : State) (signer : Pubkey)
    (h_inv : agent_nonce_is_monotonic s) (h : initialize_protocolTransition s signer = some s') :
    agent_nonce_is_monotonic s' := by
  unfold initialize_protocolTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_initialize_market (s s' : State) (signer : Pubkey)
    (h_inv : agent_nonce_is_monotonic s) (h : initialize_marketTransition s signer = some s') :
    agent_nonce_is_monotonic s' := by
  unfold initialize_marketTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_initialize_position (s s' : State) (signer : Pubkey)
    (h_inv : agent_nonce_is_monotonic s) (h : initialize_positionTransition s signer = some s') :
    agent_nonce_is_monotonic s' := by
  unfold initialize_positionTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_pause (s s' : State) (signer : Pubkey)
    (h_inv : agent_nonce_is_monotonic s) (h : pauseTransition s signer = some s') :
    agent_nonce_is_monotonic s' := by
  unfold pauseTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_unpause (s s' : State) (signer : Pubkey)
    (h_inv : agent_nonce_is_monotonic s) (h : unpauseTransition s signer = some s') :
    agent_nonce_is_monotonic s' := by
  unfold unpauseTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_configure_strategy (s s' : State) (signer : Pubkey) (enabled : Nat)
    (h_inv : agent_nonce_is_monotonic s) (h : configure_strategyTransition s signer enabled = some s') :
    agent_nonce_is_monotonic s' := by
  unfold configure_strategyTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_activate_strategy (s s' : State) (signer : Pubkey)
    (h_inv : agent_nonce_is_monotonic s) (h : activate_strategyTransition s signer = some s') :
    agent_nonce_is_monotonic s' := by
  unfold activate_strategyTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_cancel_strategy_change (s s' : State) (signer : Pubkey)
    (h_inv : agent_nonce_is_monotonic s) (h : cancel_strategy_changeTransition s signer = some s') :
    agent_nonce_is_monotonic s' := by
  unfold cancel_strategy_changeTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_propose_admin (s s' : State) (signer : Pubkey)
    (h_inv : agent_nonce_is_monotonic s) (h : propose_adminTransition s signer = some s') :
    agent_nonce_is_monotonic s' := by
  unfold propose_adminTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_accept_admin (s s' : State) (signer : Pubkey)
    (h_inv : agent_nonce_is_monotonic s) (h : accept_adminTransition s signer = some s') :
    agent_nonce_is_monotonic s' := by
  unfold accept_adminTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_deposit (s s' : State) (signer : Pubkey) (side : Nat) (amount : Nat)
    (h_inv : agent_nonce_is_monotonic s) (h : depositTransition s signer side amount = some s') :
    agent_nonce_is_monotonic s' := by
  unfold depositTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_withdraw_unmatched (s s' : State) (signer : Pubkey) (side : Nat) (amount : Nat)
    (h_inv : agent_nonce_is_monotonic s) (h : withdraw_unmatchedTransition s signer side amount = some s') :
    agent_nonce_is_monotonic s' := by
  unfold withdraw_unmatchedTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_match_positions (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : agent_nonce_is_monotonic s) (h : match_positionsTransition s signer amount = some s') :
    agent_nonce_is_monotonic s' := by
  unfold match_positionsTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_unmatch_positions (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : agent_nonce_is_monotonic s) (h : unmatch_positionsTransition s signer amount = some s') :
    agent_nonce_is_monotonic s' := by
  unfold unmatch_positionsTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_harvest_yield (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : agent_nonce_is_monotonic s) (h : harvest_yieldTransition s signer amount = some s') :
    agent_nonce_is_monotonic s' := by
  unfold harvest_yieldTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_claim_yield (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : agent_nonce_is_monotonic s) (h : claim_yieldTransition s signer amount = some s') :
    agent_nonce_is_monotonic s' := by
  unfold claim_yieldTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_resolve_market (s s' : State) (signer : Pubkey) (winning_side : Nat)
    (h_inv : agent_nonce_is_monotonic s) (h : resolve_marketTransition s signer winning_side = some s') :
    agent_nonce_is_monotonic s' := by
  unfold resolve_marketTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_update_price (s s' : State) (signer : Pubkey) (observed_slot : Nat)
    (h_inv : agent_nonce_is_monotonic s) (h : update_priceTransition s signer observed_slot = some s') :
    agent_nonce_is_monotonic s' := by
  unfold update_priceTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_initialize_lending_pool (s s' : State) (signer : Pubkey)
    (h_inv : agent_nonce_is_monotonic s) (h : initialize_lending_poolTransition s signer = some s') :
    agent_nonce_is_monotonic s' := by
  unfold initialize_lending_poolTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_initialize_lender (s s' : State) (signer : Pubkey)
    (h_inv : agent_nonce_is_monotonic s) (h : initialize_lenderTransition s signer = some s') :
    agent_nonce_is_monotonic s' := by
  unfold initialize_lenderTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_fund_lending (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_inv : agent_nonce_is_monotonic s) (h : fund_lendingTransition s signer amount = some s') :
    agent_nonce_is_monotonic s' := by
  unfold fund_lendingTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_withdraw_lending (s s' : State) (signer : Pubkey) (shares : Nat)
    (h_inv : agent_nonce_is_monotonic s) (h : withdraw_lendingTransition s signer shares = some s') :
    agent_nonce_is_monotonic s' := by
  unfold withdraw_lendingTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_initialize_loan (s s' : State) (signer : Pubkey)
    (h_inv : agent_nonce_is_monotonic s) (h : initialize_loanTransition s signer = some s') :
    agent_nonce_is_monotonic s' := by
  unfold initialize_loanTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_borrow (s s' : State) (signer : Pubkey) (amount : Nat) (collateral : Nat)
    (h_inv : agent_nonce_is_monotonic s) (h : borrowTransition s signer amount collateral = some s') :
    agent_nonce_is_monotonic s' := by
  unfold borrowTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_repay (s s' : State) (signer : Pubkey) (amount : Nat) (collateral : Nat)
    (h_inv : agent_nonce_is_monotonic s) (h : repayTransition s signer amount collateral = some s') :
    agent_nonce_is_monotonic s' := by
  unfold repayTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_liquidate (s s' : State) (signer : Pubkey)
    (h_inv : agent_nonce_is_monotonic s) (h : liquidateTransition s signer = some s') :
    agent_nonce_is_monotonic s' := by
  unfold liquidateTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_create_agent_intent (s s' : State) (signer : Pubkey) (nonce : Nat)
    (h_inv : agent_nonce_is_monotonic s) (h : create_agent_intentTransition s signer nonce = some s') :
    agent_nonce_is_monotonic s' := by
  unfold create_agent_intentTransition at h; split at h
  · next hg => cases h; unfold agent_nonce_is_monotonic at h_inv ⊢; dsimp; omega
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_execute_agent_intent (s s' : State) (signer : Pubkey)
    (h_inv : agent_nonce_is_monotonic s) (h : execute_agent_intentTransition s signer = some s') :
    agent_nonce_is_monotonic s' := by
  unfold execute_agent_intentTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

theorem agent_nonce_is_monotonic_preserved_by_cancel_agent_intent (s s' : State) (signer : Pubkey)
    (h_inv : agent_nonce_is_monotonic s) (h : cancel_agent_intentTransition s signer = some s') :
    agent_nonce_is_monotonic s' := by
  unfold cancel_agent_intentTransition at h; split at h
  · cases h; exact h_inv
  · contradiction

/-- agent_nonce_is_monotonic is preserved by every operation. Auto-proven by case split. -/
theorem agent_nonce_is_monotonic_inductive (s s' : State) (signer : Pubkey) (op : Operation)
    (h_inv : agent_nonce_is_monotonic s) (h : applyOp s signer op = some s') : agent_nonce_is_monotonic s' := by
  cases op with
  | initialize_protocol => exact agent_nonce_is_monotonic_preserved_by_initialize_protocol s s' signer h_inv h
  | initialize_market => exact agent_nonce_is_monotonic_preserved_by_initialize_market s s' signer h_inv h
  | initialize_position => exact agent_nonce_is_monotonic_preserved_by_initialize_position s s' signer h_inv h
  | pause => exact agent_nonce_is_monotonic_preserved_by_pause s s' signer h_inv h
  | unpause => exact agent_nonce_is_monotonic_preserved_by_unpause s s' signer h_inv h
  | configure_strategy enabled => exact agent_nonce_is_monotonic_preserved_by_configure_strategy s s' signer enabled h_inv h
  | activate_strategy => exact agent_nonce_is_monotonic_preserved_by_activate_strategy s s' signer h_inv h
  | cancel_strategy_change => exact agent_nonce_is_monotonic_preserved_by_cancel_strategy_change s s' signer h_inv h
  | propose_admin => exact agent_nonce_is_monotonic_preserved_by_propose_admin s s' signer h_inv h
  | accept_admin => exact agent_nonce_is_monotonic_preserved_by_accept_admin s s' signer h_inv h
  | deposit side amount => exact agent_nonce_is_monotonic_preserved_by_deposit s s' signer side amount h_inv h
  | withdraw_unmatched side amount => exact agent_nonce_is_monotonic_preserved_by_withdraw_unmatched s s' signer side amount h_inv h
  | match_positions amount => exact agent_nonce_is_monotonic_preserved_by_match_positions s s' signer amount h_inv h
  | unmatch_positions amount => exact agent_nonce_is_monotonic_preserved_by_unmatch_positions s s' signer amount h_inv h
  | harvest_yield amount => exact agent_nonce_is_monotonic_preserved_by_harvest_yield s s' signer amount h_inv h
  | claim_yield amount => exact agent_nonce_is_monotonic_preserved_by_claim_yield s s' signer amount h_inv h
  | resolve_market winning_side => exact agent_nonce_is_monotonic_preserved_by_resolve_market s s' signer winning_side h_inv h
  | update_price observed_slot => exact agent_nonce_is_monotonic_preserved_by_update_price s s' signer observed_slot h_inv h
  | initialize_lending_pool => exact agent_nonce_is_monotonic_preserved_by_initialize_lending_pool s s' signer h_inv h
  | initialize_lender => exact agent_nonce_is_monotonic_preserved_by_initialize_lender s s' signer h_inv h
  | fund_lending amount => exact agent_nonce_is_monotonic_preserved_by_fund_lending s s' signer amount h_inv h
  | withdraw_lending shares => exact agent_nonce_is_monotonic_preserved_by_withdraw_lending s s' signer shares h_inv h
  | initialize_loan => exact agent_nonce_is_monotonic_preserved_by_initialize_loan s s' signer h_inv h
  | borrow amount collateral => exact agent_nonce_is_monotonic_preserved_by_borrow s s' signer amount collateral h_inv h
  | repay amount collateral => exact agent_nonce_is_monotonic_preserved_by_repay s s' signer amount collateral h_inv h
  | liquidate => exact agent_nonce_is_monotonic_preserved_by_liquidate s s' signer h_inv h
  | create_agent_intent nonce => exact agent_nonce_is_monotonic_preserved_by_create_agent_intent s s' signer nonce h_inv h
  | execute_agent_intent => exact agent_nonce_is_monotonic_preserved_by_execute_agent_intent s s' signer h_inv h
  | cancel_agent_intent => exact agent_nonce_is_monotonic_preserved_by_cancel_agent_intent s s' signer h_inv h

-- ============================================================================
-- Abort conditions — operations must reject under specified conditions
-- ============================================================================

theorem initialize_protocol_aborts_if_InvalidAmount (s : State) (signer : Pubkey)
    (h : ¬(s.config_initialized = 0)) : initialize_protocolTransition s signer = none := by
  unfold initialize_protocolTransition
  rw [if_neg (fun hg => h hg.2)]

theorem initialize_market_aborts_if_InvalidAmount (s : State) (signer : Pubkey)
    (h : ¬(s.config_initialized = 1)) : initialize_marketTransition s signer = none := by
  unfold initialize_marketTransition
  rw [if_neg (fun hg => h hg.2.1)]

theorem initialize_market_aborts_if_MathOverflow (s : State) (signer : Pubkey)
    (h : ¬(s.market_count + 1 ≤ 1000000000000)) : initialize_marketTransition s signer = none := by
  unfold initialize_marketTransition
  rw [if_neg (fun hg => h hg.2.2)]

theorem initialize_position_aborts_if_MathOverflow (s : State) (signer : Pubkey)
    (h : ¬(s.position_count + 1 ≤ 1000000000000)) : initialize_positionTransition s signer = none := by
  unfold initialize_positionTransition
  rw [if_neg (fun hg => h hg.2)]

theorem configure_strategy_aborts_if_InvalidAmount (s : State) (signer : Pubkey) (enabled : Nat)
    (h : ¬(enabled ≤ 1)) : configure_strategyTransition s signer enabled = none := by
  unfold configure_strategyTransition
  rw [if_neg (fun hg => h hg.2)]

theorem activate_strategy_aborts_if_InvalidAmount (s : State) (signer : Pubkey)
    (h : ¬(s.strategy_activate_after > 0)) : activate_strategyTransition s signer = none := by
  unfold activate_strategyTransition
  rw [if_neg (fun hg => h hg.2)]

theorem cancel_strategy_change_aborts_if_InvalidAmount (s : State) (signer : Pubkey)
    (h : ¬(s.strategy_activate_after > 0)) : cancel_strategy_changeTransition s signer = none := by
  unfold cancel_strategy_changeTransition
  rw [if_neg (fun hg => h hg.2)]

theorem accept_admin_aborts_if_InvalidAmount (s : State) (signer : Pubkey)
    (h : ¬(s.pending_admin = 1)) : accept_adminTransition s signer = none := by
  unfold accept_adminTransition
  rw [if_neg (fun hg => h hg.2.2)]

theorem deposit_aborts_if_ProtocolPaused (s : State) (signer : Pubkey) (side : Nat) (amount : Nat)
    (h : ¬(s.paused = 0)) : depositTransition s signer side amount = none := by
  unfold depositTransition
  rw [if_neg (fun hg => h hg.2.1)]

theorem deposit_aborts_if_InvalidAmount (s : State) (signer : Pubkey) (side : Nat) (amount : Nat)
    (h : ¬(side ≤ 1 ∧ amount > 0)) : depositTransition s signer side amount = none := by
  unfold depositTransition
  rw [if_neg (fun hg => h ⟨hg.2.2.1, hg.2.2.2.1⟩)]

theorem deposit_aborts_if_TvlCapExceeded_0 (s : State) (signer : Pubkey) (side : Nat) (amount : Nat)
    (h : ¬(s.total_yes + amount ≤ 1000000000000)) : depositTransition s signer side amount = none := by
  unfold depositTransition
  rw [if_neg (fun hg => h hg.2.2.2.2.1)]

theorem deposit_aborts_if_TvlCapExceeded_1 (s : State) (signer : Pubkey) (side : Nat) (amount : Nat)
    (h : ¬(s.total_no + amount ≤ 1000000000000)) : depositTransition s signer side amount = none := by
  unfold depositTransition
  rw [if_neg (fun hg => h hg.2.2.2.2.2)]

theorem withdraw_unmatched_aborts_if_InvalidAmount (s : State) (signer : Pubkey) (side : Nat) (amount : Nat)
    (h : ¬(side ≤ 1 ∧ amount > 0)) : withdraw_unmatchedTransition s signer side amount = none := by
  unfold withdraw_unmatchedTransition
  rw [if_neg (fun hg => h ⟨hg.2.2.2.1, hg.2.2.2.2.1⟩)]

theorem withdraw_unmatched_aborts_if_InsufficientUnmatched_0 (s : State) (signer : Pubkey) (side : Nat) (amount : Nat)
    (h : ¬(s.total_yes - s.matched_pairs ≥ amount)) : withdraw_unmatchedTransition s signer side amount = none := by
  unfold withdraw_unmatchedTransition
  rw [if_neg (fun hg => h hg.2.2.2.2.2.1)]

theorem withdraw_unmatched_aborts_if_InsufficientUnmatched_1 (s : State) (signer : Pubkey) (side : Nat) (amount : Nat)
    (h : ¬(s.total_no - s.matched_pairs ≥ amount)) : withdraw_unmatchedTransition s signer side amount = none := by
  unfold withdraw_unmatchedTransition
  rw [if_neg (fun hg => h hg.2.2.2.2.2.2)]

theorem match_positions_aborts_if_ProtocolPaused (s : State) (signer : Pubkey) (amount : Nat)
    (h : ¬(s.paused = 0)) : match_positionsTransition s signer amount = none := by
  unfold match_positionsTransition
  rw [if_neg (fun hg => h hg.2.1)]

theorem match_positions_aborts_if_InvalidAmount (s : State) (signer : Pubkey) (amount : Nat)
    (h : ¬(amount > 0)) : match_positionsTransition s signer amount = none := by
  unfold match_positionsTransition
  rw [if_neg (fun hg => h hg.2.2.1)]

theorem match_positions_aborts_if_InsufficientUnmatched_0 (s : State) (signer : Pubkey) (amount : Nat)
    (h : ¬(s.total_yes - s.matched_pairs ≥ amount)) : match_positionsTransition s signer amount = none := by
  unfold match_positionsTransition
  rw [if_neg (fun hg => h hg.2.2.2.1)]

theorem match_positions_aborts_if_InsufficientUnmatched_1 (s : State) (signer : Pubkey) (amount : Nat)
    (h : ¬(s.total_no - s.matched_pairs ≥ amount)) : match_positionsTransition s signer amount = none := by
  unfold match_positionsTransition
  rw [if_neg (fun hg => h hg.2.2.2.2.1)]

theorem match_positions_aborts_if_TvlCapExceeded (s : State) (signer : Pubkey) (amount : Nat)
    (h : ¬(s.matched_pairs + amount ≤ 1000000000000)) : match_positionsTransition s signer amount = none := by
  unfold match_positionsTransition
  rw [if_neg (fun hg => h hg.2.2.2.2.2)]

theorem unmatch_positions_aborts_if_InvalidAmount (s : State) (signer : Pubkey) (amount : Nat)
    (h : ¬(amount > 0)) : unmatch_positionsTransition s signer amount = none := by
  unfold unmatch_positionsTransition
  rw [if_neg (fun hg => h hg.2.2.1)]

theorem unmatch_positions_aborts_if_InsufficientMatched (s : State) (signer : Pubkey) (amount : Nat)
    (h : ¬(s.matched_pairs ≥ amount)) : unmatch_positionsTransition s signer amount = none := by
  unfold unmatch_positionsTransition
  rw [if_neg (fun hg => h hg.2.2.2.1)]

theorem unmatch_positions_aborts_if_StrategyLimitExceeded (s : State) (signer : Pubkey) (amount : Nat)
    (h : ¬(s.strategy_principal ≤ s.matched_pairs - amount)) : unmatch_positionsTransition s signer amount = none := by
  unfold unmatch_positionsTransition
  rw [if_neg (fun hg => h hg.2.2.2.2)]

theorem harvest_yield_aborts_if_ProtocolPaused (s : State) (signer : Pubkey) (amount : Nat)
    (h : ¬(s.paused = 0)) : harvest_yieldTransition s signer amount = none := by
  unfold harvest_yieldTransition
  rw [if_neg (fun hg => h hg.2.1)]

theorem harvest_yield_aborts_if_InvalidAmount_0 (s : State) (signer : Pubkey) (amount : Nat)
    (h : ¬(s.strategy_enabled = 1)) : harvest_yieldTransition s signer amount = none := by
  unfold harvest_yieldTransition
  rw [if_neg (fun hg => h hg.2.2.1)]

theorem harvest_yield_aborts_if_InvalidAmount_1 (s : State) (signer : Pubkey) (amount : Nat)
    (h : ¬(amount > 0 ∧ s.matched_pairs > 0)) : harvest_yieldTransition s signer amount = none := by
  unfold harvest_yieldTransition
  rw [if_neg (fun hg => h ⟨hg.2.2.2.1, hg.2.2.2.2.1⟩)]

theorem harvest_yield_aborts_if_TvlCapExceeded (s : State) (signer : Pubkey) (amount : Nat)
    (h : ¬(s.harvested_yield + amount ≤ 1000000000000)) : harvest_yieldTransition s signer amount = none := by
  unfold harvest_yieldTransition
  rw [if_neg (fun hg => h hg.2.2.2.2.2)]

theorem claim_yield_aborts_if_InvalidAmount (s : State) (signer : Pubkey) (amount : Nat)
    (h : ¬(amount > 0)) : claim_yieldTransition s signer amount = none := by
  unfold claim_yieldTransition
  rw [if_neg (fun hg => h hg.2.1)]

theorem claim_yield_aborts_if_YieldUnavailable (s : State) (signer : Pubkey) (amount : Nat)
    (h : ¬(s.harvested_yield - s.claimed_yield ≥ amount)) : claim_yieldTransition s signer amount = none := by
  unfold claim_yieldTransition
  rw [if_neg (fun hg => h hg.2.2.1)]

theorem claim_yield_aborts_if_TvlCapExceeded (s : State) (signer : Pubkey) (amount : Nat)
    (h : ¬(s.claimed_yield + amount ≤ 1000000000000)) : claim_yieldTransition s signer amount = none := by
  unfold claim_yieldTransition
  rw [if_neg (fun hg => h hg.2.2.2)]

theorem resolve_market_aborts_if_AlreadyResolved (s : State) (signer : Pubkey) (winning_side : Nat)
    (h : ¬(s.status = 0)) : resolve_marketTransition s signer winning_side = none := by
  unfold resolve_marketTransition
  rw [if_neg (fun hg => h hg.2.1)]

theorem resolve_market_aborts_if_InvalidAmount (s : State) (signer : Pubkey) (winning_side : Nat)
    (h : ¬(winning_side ≤ 1)) : resolve_marketTransition s signer winning_side = none := by
  unfold resolve_marketTransition
  rw [if_neg (fun hg => h hg.2.2.1)]

theorem resolve_market_aborts_if_StrategyLimitExceeded (s : State) (signer : Pubkey) (winning_side : Nat)
    (h : ¬(s.strategy_principal = 0)) : resolve_marketTransition s signer winning_side = none := by
  unfold resolve_marketTransition
  rw [if_neg (fun hg => h hg.2.2.2)]

theorem update_price_aborts_if_InvalidAmount (s : State) (signer : Pubkey) (observed_slot : Nat)
    (h : ¬(observed_slot > s.observed_slot)) : update_priceTransition s signer observed_slot = none := by
  unfold update_priceTransition
  rw [if_neg (fun hg => h hg.2)]

theorem initialize_lending_pool_aborts_if_InvalidAmount (s : State) (signer : Pubkey)
    (h : ¬(s.total_cash = 0 ∧ s.total_borrows = 0)) : initialize_lending_poolTransition s signer = none := by
  unfold initialize_lending_poolTransition
  rw [if_neg (fun hg => h ⟨hg.2.1, hg.2.2⟩)]

theorem initialize_lender_aborts_if_MathOverflow (s : State) (signer : Pubkey)
    (h : ¬(s.lender_count + 1 ≤ 1000000000000)) : initialize_lenderTransition s signer = none := by
  unfold initialize_lenderTransition
  rw [if_neg (fun hg => h hg.2)]

theorem fund_lending_aborts_if_ProtocolPaused (s : State) (signer : Pubkey) (amount : Nat)
    (h : ¬(s.paused = 0)) : fund_lendingTransition s signer amount = none := by
  unfold fund_lendingTransition
  rw [if_neg (fun hg => h hg.2.1)]

theorem fund_lending_aborts_if_InvalidAmount (s : State) (signer : Pubkey) (amount : Nat)
    (h : ¬(amount > 0)) : fund_lendingTransition s signer amount = none := by
  unfold fund_lendingTransition
  rw [if_neg (fun hg => h hg.2.2.1)]

theorem fund_lending_aborts_if_TvlCapExceeded_0 (s : State) (signer : Pubkey) (amount : Nat)
    (h : ¬(s.total_cash + amount ≤ 1000000000000)) : fund_lendingTransition s signer amount = none := by
  unfold fund_lendingTransition
  rw [if_neg (fun hg => h hg.2.2.2.1)]

theorem fund_lending_aborts_if_TvlCapExceeded_1 (s : State) (signer : Pubkey) (amount : Nat)
    (h : ¬(s.total_lender_shares + amount ≤ 1000000000000)) : fund_lendingTransition s signer amount = none := by
  unfold fund_lendingTransition
  rw [if_neg (fun hg => h hg.2.2.2.2)]

theorem withdraw_lending_aborts_if_InvalidAmount (s : State) (signer : Pubkey) (shares : Nat)
    (h : ¬(shares > 0)) : withdraw_lendingTransition s signer shares = none := by
  unfold withdraw_lendingTransition
  rw [if_neg (fun hg => h hg.2.2.2.1)]

theorem withdraw_lending_aborts_if_Insolvent (s : State) (signer : Pubkey) (shares : Nat)
    (h : ¬(s.total_lender_shares ≥ shares)) : withdraw_lendingTransition s signer shares = none := by
  unfold withdraw_lendingTransition
  rw [if_neg (fun hg => h hg.2.2.2.2.1)]

theorem withdraw_lending_aborts_if_InsufficientLiquidity (s : State) (signer : Pubkey) (shares : Nat)
    (h : ¬(s.total_cash ≥ shares)) : withdraw_lendingTransition s signer shares = none := by
  unfold withdraw_lendingTransition
  rw [if_neg (fun hg => h hg.2.2.2.2.2)]

theorem initialize_loan_aborts_if_MathOverflow (s : State) (signer : Pubkey)
    (h : ¬(s.loan_count + 1 ≤ 1000000000000)) : initialize_loanTransition s signer = none := by
  unfold initialize_loanTransition
  rw [if_neg (fun hg => h hg.2)]

theorem borrow_aborts_if_ProtocolPaused (s : State) (signer : Pubkey) (amount : Nat) (collateral : Nat)
    (h : ¬(s.paused = 0)) : borrowTransition s signer amount collateral = none := by
  unfold borrowTransition
  rw [if_neg (fun hg => h hg.2.2.1)]

theorem borrow_aborts_if_InvalidAmount (s : State) (signer : Pubkey) (amount : Nat) (collateral : Nat)
    (h : ¬(amount > 0 ∧ collateral > 0)) : borrowTransition s signer amount collateral = none := by
  unfold borrowTransition
  rw [if_neg (fun hg => h ⟨hg.2.2.2.1, hg.2.2.2.2.1⟩)]

theorem borrow_aborts_if_InsufficientLiquidity (s : State) (signer : Pubkey) (amount : Nat) (collateral : Nat)
    (h : ¬(s.total_cash ≥ amount)) : borrowTransition s signer amount collateral = none := by
  unfold borrowTransition
  rw [if_neg (fun hg => h hg.2.2.2.2.2.1)]

theorem borrow_aborts_if_TvlCapExceeded_0 (s : State) (signer : Pubkey) (amount : Nat) (collateral : Nat)
    (h : ¬(s.total_borrows + amount ≤ 1000000000000)) : borrowTransition s signer amount collateral = none := by
  unfold borrowTransition
  rw [if_neg (fun hg => h hg.2.2.2.2.2.2.1)]

theorem borrow_aborts_if_TvlCapExceeded_1 (s : State) (signer : Pubkey) (amount : Nat) (collateral : Nat)
    (h : ¬(s.collateral_amount + collateral ≤ 1000000000000)) : borrowTransition s signer amount collateral = none := by
  unfold borrowTransition
  rw [if_neg (fun hg => h hg.2.2.2.2.2.2.2)]

theorem repay_aborts_if_InvalidAmount (s : State) (signer : Pubkey) (amount : Nat) (collateral : Nat)
    (h : ¬(amount > 0)) : repayTransition s signer amount collateral = none := by
  unfold repayTransition
  rw [if_neg (fun hg => h hg.2.2.2.1)]

theorem repay_aborts_if_Insolvent_0 (s : State) (signer : Pubkey) (amount : Nat) (collateral : Nat)
    (h : ¬(s.total_borrows ≥ amount)) : repayTransition s signer amount collateral = none := by
  unfold repayTransition
  rw [if_neg (fun hg => h hg.2.2.2.2.1)]

theorem repay_aborts_if_Insolvent_1 (s : State) (signer : Pubkey) (amount : Nat) (collateral : Nat)
    (h : ¬(s.collateral_amount ≥ collateral)) : repayTransition s signer amount collateral = none := by
  unfold repayTransition
  rw [if_neg (fun hg => h hg.2.2.2.2.2.1)]

theorem repay_aborts_if_TvlCapExceeded (s : State) (signer : Pubkey) (amount : Nat) (collateral : Nat)
    (h : ¬(s.total_cash + amount ≤ 1000000000000)) : repayTransition s signer amount collateral = none := by
  unfold repayTransition
  rw [if_neg (fun hg => h hg.2.2.2.2.2.2)]

theorem liquidate_aborts_if_InvalidAmount (s : State) (signer : Pubkey)
    (h : ¬(s.total_borrows > 0 ∧ s.collateral_amount > 0)) : liquidateTransition s signer = none := by
  unfold liquidateTransition
  rw [if_neg (fun hg => h ⟨hg.2.1, hg.2.2.1⟩)]

theorem liquidate_aborts_if_TvlCapExceeded (s : State) (signer : Pubkey)
    (h : ¬(s.total_cash + s.total_borrows ≤ 1000000000000)) : liquidateTransition s signer = none := by
  unfold liquidateTransition
  rw [if_neg (fun hg => h hg.2.2.2.1)]

theorem create_agent_intent_aborts_if_InvalidNonce (s : State) (signer : Pubkey) (nonce : Nat)
    (h : ¬(nonce = s.next_intent_nonce)) : create_agent_intentTransition s signer nonce = none := by
  unfold create_agent_intentTransition
  rw [if_neg (fun hg => h hg.2.1)]

theorem create_agent_intent_aborts_if_MathOverflow (s : State) (signer : Pubkey) (nonce : Nat)
    (h : ¬(s.next_intent_nonce + 1 ≤ 1000000000000)) : create_agent_intentTransition s signer nonce = none := by
  unfold create_agent_intentTransition
  rw [if_neg (fun hg => h hg.2.2)]

theorem execute_agent_intent_aborts_if_InvalidNonce (s : State) (signer : Pubkey)
    (h : ¬(s.consumed = 0)) : execute_agent_intentTransition s signer = none := by
  unfold execute_agent_intentTransition
  rw [if_neg (fun hg => h hg.2)]

theorem cancel_agent_intent_aborts_if_InvalidNonce (s : State) (signer : Pubkey)
    (h : ¬(s.consumed = 0)) : cancel_agent_intentTransition s signer = none := by
  unfold cancel_agent_intentTransition
  rw [if_neg (fun hg => h hg.2)]

-- ============================================================================
-- Cover properties — reachability (existential proofs)
-- ============================================================================

/-- matched_yield_cycle — trace [deposit, match_positions, harvest_yield, claim_yield, unmatch_positions] is reachable. -/
theorem cover_matched_yield_cycle : ∃ (s0 : State) (signer : Pubkey),
    ∃ (v0_0 : Nat) (v0_1 : Nat), ∃ (s1 : State), depositTransition s0 signer v0_0 v0_1 = some s1 ∧
      ∃ (v1_0 : Nat), ∃ (s2 : State), match_positionsTransition s1 signer v1_0 = some s2 ∧
        ∃ (v2_0 : Nat), ∃ (s3 : State), harvest_yieldTransition s2 signer v2_0 = some s3 ∧
          ∃ (v3_0 : Nat), ∃ (s4 : State), claim_yieldTransition s3 signer v3_0 = some s4 ∧
            ∃ (v4_0 : Nat), unmatch_positionsTransition s4 signer v4_0 ≠ none := by
  let pk : Pubkey := ⟨0, 0, 0, 0⟩
  let s0 : State := ⟨0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, .Active⟩
  let s1 : State := ⟨0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, .Active⟩
  let s2 : State := ⟨0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, .Active⟩
  let s3 : State := ⟨0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, .Active⟩
  let s4 : State := ⟨0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, .Active⟩
  exact ⟨s0, pk, 1, 1, s1, by decide, 1, s2, by decide, 1, s3, by decide, 1, s4, by decide, 1, by decide⟩

/-- lending_cycle — trace [fund_lending, borrow, repay, liquidate, withdraw_lending] is reachable. -/
theorem cover_lending_cycle : ∃ (s0 : State) (signer : Pubkey),
    ∃ (v0_0 : Nat), ∃ (s1 : State), fund_lendingTransition s0 signer v0_0 = some s1 ∧
      ∃ (v1_0 : Nat) (v1_1 : Nat), ∃ (s2 : State), borrowTransition s1 signer v1_0 v1_1 = some s2 ∧
        ∃ (v2_0 : Nat) (v2_1 : Nat), ∃ (s3 : State), repayTransition s2 signer v2_0 v2_1 = some s3 ∧
∃ (s4 : State), liquidateTransition s3 signer = some s4 ∧
            ∃ (v4_0 : Nat), withdraw_lendingTransition s4 signer v4_0 ≠ none := by
  let pk : Pubkey := ⟨0, 0, 0, 0⟩
  let s0 : State := ⟨0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, .Active⟩
  let s1 : State := ⟨0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, .Active⟩
  let s2 : State := ⟨0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, .Active⟩
  let s3 : State := ⟨0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, .Active⟩
  let s4 : State := ⟨0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, .Active⟩
  exact ⟨s0, pk, 1, s1, by decide, 1, 1, s2, by decide, 1, 1, s3, by decide, s4, by decide, 1, by decide⟩

/-- agent_cycle — trace [create_agent_intent, execute_agent_intent, cancel_agent_intent] is reachable. -/
theorem cover_agent_cycle : ∃ (s0 : State) (signer : Pubkey),
    ∃ (v0_0 : Nat), ∃ (s1 : State), create_agent_intentTransition s0 signer v0_0 = some s1 ∧
∃ (s2 : State), execute_agent_intentTransition s1 signer = some s2 ∧
cancel_agent_intentTransition s2 signer ≠ none := by
  let pk : Pubkey := ⟨0, 0, 0, 0⟩
  let s0 : State := ⟨0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, .Active⟩
  let s1 : State := ⟨0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, .Active⟩
  let s2 : State := ⟨0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, .Active⟩
  exact ⟨s0, pk, 1, s1, by decide, s2, by decide, by decide⟩

/-- governance_cycle — trace [propose_admin, accept_admin, configure_strategy, activate_strategy] is reachable. -/
theorem cover_governance_cycle : ∃ (s0 : State) (signer : Pubkey),
∃ (s1 : State), propose_adminTransition s0 signer = some s1 ∧
∃ (s2 : State), accept_adminTransition s1 signer = some s2 ∧
        ∃ (v2_0 : Nat), ∃ (s3 : State), configure_strategyTransition s2 signer v2_0 = some s3 ∧
activate_strategyTransition s3 signer ≠ none := by
  let pk : Pubkey := ⟨0, 0, 0, 0⟩
  let s0 : State := ⟨0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, .Active⟩
  let s1 : State := ⟨0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, .Active⟩
  let s2 : State := ⟨0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, .Active⟩
  let s3 : State := ⟨0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, .Active⟩
  exact ⟨s0, pk, s1, by decide, s2, by decide, 1, s3, by decide, by decide⟩

-- ============================================================================
-- Overflow safety obligations (auto-generated for operations with add effects)
-- ============================================================================

theorem initialize_market_overflow_safe (s s' : State) (signer : Pubkey)
    (h_valid : valid_u8 s.config_initialized ∧ valid_u64 s.market_count ∧ valid_u64 s.position_count ∧ valid_u64 s.lender_count ∧ valid_u64 s.loan_count ∧ valid_u8 s.paused ∧ valid_u8 s.strategy_enabled ∧ valid_u8 s.pending_strategy_enabled ∧ valid_u64 s.strategy_activate_after ∧ valid_u8 s.pending_admin ∧ valid_u64 s.total_yes ∧ valid_u64 s.total_no ∧ valid_u64 s.matched_pairs ∧ valid_u64 s.strategy_principal ∧ valid_u64 s.harvested_yield ∧ valid_u64 s.claimed_yield ∧ valid_u64 s.total_cash ∧ valid_u64 s.total_borrows ∧ valid_u64 s.total_lender_shares ∧ valid_u64 s.collateral_amount ∧ valid_u64 s.bad_debt ∧ valid_u8 s.status ∧ valid_u64 s.next_intent_nonce ∧ valid_u8 s.consumed ∧ valid_u64 s.observed_slot)
    (h_inv_matched_pairs_are_backed : matched_pairs_are_backed s)
    (h_inv_strategy_is_pair_backed : strategy_is_pair_backed s)
    (h_inv_yield_cannot_be_overclaimed : yield_cannot_be_overclaimed s)
    (h_inv_lending_is_conserved : lending_is_conserved s)
    (h : initialize_marketTransition s signer = some s') :
    valid_u8 s'.config_initialized ∧ valid_u64 s'.market_count ∧ valid_u64 s'.position_count ∧ valid_u64 s'.lender_count ∧ valid_u64 s'.loan_count ∧ valid_u8 s'.paused ∧ valid_u8 s'.strategy_enabled ∧ valid_u8 s'.pending_strategy_enabled ∧ valid_u64 s'.strategy_activate_after ∧ valid_u8 s'.pending_admin ∧ valid_u64 s'.total_yes ∧ valid_u64 s'.total_no ∧ valid_u64 s'.matched_pairs ∧ valid_u64 s'.strategy_principal ∧ valid_u64 s'.harvested_yield ∧ valid_u64 s'.claimed_yield ∧ valid_u64 s'.total_cash ∧ valid_u64 s'.total_borrows ∧ valid_u64 s'.total_lender_shares ∧ valid_u64 s'.collateral_amount ∧ valid_u64 s'.bad_debt ∧ valid_u8 s'.status ∧ valid_u64 s'.next_intent_nonce ∧ valid_u8 s'.consumed ∧ valid_u64 s'.observed_slot := by
  unfold initialize_marketTransition at h; split at h
  · next hg =>
    cases h
    refine ⟨h_valid.1, ?_, h_valid.2.2.1, h_valid.2.2.2.1, h_valid.2.2.2.2.1, h_valid.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2⟩
    simp only [valid_u64, Valid.valid_u64, Valid.U64_MAX]; omega
  · contradiction

theorem initialize_position_overflow_safe (s s' : State) (signer : Pubkey)
    (h_valid : valid_u8 s.config_initialized ∧ valid_u64 s.market_count ∧ valid_u64 s.position_count ∧ valid_u64 s.lender_count ∧ valid_u64 s.loan_count ∧ valid_u8 s.paused ∧ valid_u8 s.strategy_enabled ∧ valid_u8 s.pending_strategy_enabled ∧ valid_u64 s.strategy_activate_after ∧ valid_u8 s.pending_admin ∧ valid_u64 s.total_yes ∧ valid_u64 s.total_no ∧ valid_u64 s.matched_pairs ∧ valid_u64 s.strategy_principal ∧ valid_u64 s.harvested_yield ∧ valid_u64 s.claimed_yield ∧ valid_u64 s.total_cash ∧ valid_u64 s.total_borrows ∧ valid_u64 s.total_lender_shares ∧ valid_u64 s.collateral_amount ∧ valid_u64 s.bad_debt ∧ valid_u8 s.status ∧ valid_u64 s.next_intent_nonce ∧ valid_u8 s.consumed ∧ valid_u64 s.observed_slot)
    (h_inv_matched_pairs_are_backed : matched_pairs_are_backed s)
    (h_inv_strategy_is_pair_backed : strategy_is_pair_backed s)
    (h_inv_yield_cannot_be_overclaimed : yield_cannot_be_overclaimed s)
    (h_inv_lending_is_conserved : lending_is_conserved s)
    (h : initialize_positionTransition s signer = some s') :
    valid_u8 s'.config_initialized ∧ valid_u64 s'.market_count ∧ valid_u64 s'.position_count ∧ valid_u64 s'.lender_count ∧ valid_u64 s'.loan_count ∧ valid_u8 s'.paused ∧ valid_u8 s'.strategy_enabled ∧ valid_u8 s'.pending_strategy_enabled ∧ valid_u64 s'.strategy_activate_after ∧ valid_u8 s'.pending_admin ∧ valid_u64 s'.total_yes ∧ valid_u64 s'.total_no ∧ valid_u64 s'.matched_pairs ∧ valid_u64 s'.strategy_principal ∧ valid_u64 s'.harvested_yield ∧ valid_u64 s'.claimed_yield ∧ valid_u64 s'.total_cash ∧ valid_u64 s'.total_borrows ∧ valid_u64 s'.total_lender_shares ∧ valid_u64 s'.collateral_amount ∧ valid_u64 s'.bad_debt ∧ valid_u8 s'.status ∧ valid_u64 s'.next_intent_nonce ∧ valid_u8 s'.consumed ∧ valid_u64 s'.observed_slot := by
  unfold initialize_positionTransition at h; split at h
  · next hg =>
    cases h
    refine ⟨h_valid.1, h_valid.2.1, ?_, h_valid.2.2.2.1, h_valid.2.2.2.2.1, h_valid.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2⟩
    simp only [valid_u64, Valid.valid_u64, Valid.U64_MAX]; omega
  · contradiction

theorem deposit_overflow_safe (s s' : State) (signer : Pubkey) (side : Nat) (amount : Nat)
    (h_valid : valid_u8 s.config_initialized ∧ valid_u64 s.market_count ∧ valid_u64 s.position_count ∧ valid_u64 s.lender_count ∧ valid_u64 s.loan_count ∧ valid_u8 s.paused ∧ valid_u8 s.strategy_enabled ∧ valid_u8 s.pending_strategy_enabled ∧ valid_u64 s.strategy_activate_after ∧ valid_u8 s.pending_admin ∧ valid_u64 s.total_yes ∧ valid_u64 s.total_no ∧ valid_u64 s.matched_pairs ∧ valid_u64 s.strategy_principal ∧ valid_u64 s.harvested_yield ∧ valid_u64 s.claimed_yield ∧ valid_u64 s.total_cash ∧ valid_u64 s.total_borrows ∧ valid_u64 s.total_lender_shares ∧ valid_u64 s.collateral_amount ∧ valid_u64 s.bad_debt ∧ valid_u8 s.status ∧ valid_u64 s.next_intent_nonce ∧ valid_u8 s.consumed ∧ valid_u64 s.observed_slot)
    (h_inv_matched_pairs_are_backed : matched_pairs_are_backed s)
    (h_inv_strategy_is_pair_backed : strategy_is_pair_backed s)
    (h_inv_yield_cannot_be_overclaimed : yield_cannot_be_overclaimed s)
    (h_inv_lending_is_conserved : lending_is_conserved s)
    (h : depositTransition s signer side amount = some s') :
    valid_u8 s'.config_initialized ∧ valid_u64 s'.market_count ∧ valid_u64 s'.position_count ∧ valid_u64 s'.lender_count ∧ valid_u64 s'.loan_count ∧ valid_u8 s'.paused ∧ valid_u8 s'.strategy_enabled ∧ valid_u8 s'.pending_strategy_enabled ∧ valid_u64 s'.strategy_activate_after ∧ valid_u8 s'.pending_admin ∧ valid_u64 s'.total_yes ∧ valid_u64 s'.total_no ∧ valid_u64 s'.matched_pairs ∧ valid_u64 s'.strategy_principal ∧ valid_u64 s'.harvested_yield ∧ valid_u64 s'.claimed_yield ∧ valid_u64 s'.total_cash ∧ valid_u64 s'.total_borrows ∧ valid_u64 s'.total_lender_shares ∧ valid_u64 s'.collateral_amount ∧ valid_u64 s'.bad_debt ∧ valid_u8 s'.status ∧ valid_u64 s'.next_intent_nonce ∧ valid_u8 s'.consumed ∧ valid_u64 s'.observed_slot := by
  unfold depositTransition at h; split at h
  · next hg =>
    cases h
    refine ⟨h_valid.1, h_valid.2.1, h_valid.2.2.1, h_valid.2.2.2.1, h_valid.2.2.2.2.1, h_valid.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.1, ?_, ?_, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2⟩
    simp only [valid_u64, Valid.valid_u64, Valid.U64_MAX]; omega
    simp only [valid_u64, Valid.valid_u64, Valid.U64_MAX]; omega
  · contradiction

theorem match_positions_overflow_safe (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_valid : valid_u8 s.config_initialized ∧ valid_u64 s.market_count ∧ valid_u64 s.position_count ∧ valid_u64 s.lender_count ∧ valid_u64 s.loan_count ∧ valid_u8 s.paused ∧ valid_u8 s.strategy_enabled ∧ valid_u8 s.pending_strategy_enabled ∧ valid_u64 s.strategy_activate_after ∧ valid_u8 s.pending_admin ∧ valid_u64 s.total_yes ∧ valid_u64 s.total_no ∧ valid_u64 s.matched_pairs ∧ valid_u64 s.strategy_principal ∧ valid_u64 s.harvested_yield ∧ valid_u64 s.claimed_yield ∧ valid_u64 s.total_cash ∧ valid_u64 s.total_borrows ∧ valid_u64 s.total_lender_shares ∧ valid_u64 s.collateral_amount ∧ valid_u64 s.bad_debt ∧ valid_u8 s.status ∧ valid_u64 s.next_intent_nonce ∧ valid_u8 s.consumed ∧ valid_u64 s.observed_slot)
    (h_inv_matched_pairs_are_backed : matched_pairs_are_backed s)
    (h_inv_strategy_is_pair_backed : strategy_is_pair_backed s)
    (h_inv_yield_cannot_be_overclaimed : yield_cannot_be_overclaimed s)
    (h_inv_lending_is_conserved : lending_is_conserved s)
    (h : match_positionsTransition s signer amount = some s') :
    valid_u8 s'.config_initialized ∧ valid_u64 s'.market_count ∧ valid_u64 s'.position_count ∧ valid_u64 s'.lender_count ∧ valid_u64 s'.loan_count ∧ valid_u8 s'.paused ∧ valid_u8 s'.strategy_enabled ∧ valid_u8 s'.pending_strategy_enabled ∧ valid_u64 s'.strategy_activate_after ∧ valid_u8 s'.pending_admin ∧ valid_u64 s'.total_yes ∧ valid_u64 s'.total_no ∧ valid_u64 s'.matched_pairs ∧ valid_u64 s'.strategy_principal ∧ valid_u64 s'.harvested_yield ∧ valid_u64 s'.claimed_yield ∧ valid_u64 s'.total_cash ∧ valid_u64 s'.total_borrows ∧ valid_u64 s'.total_lender_shares ∧ valid_u64 s'.collateral_amount ∧ valid_u64 s'.bad_debt ∧ valid_u8 s'.status ∧ valid_u64 s'.next_intent_nonce ∧ valid_u8 s'.consumed ∧ valid_u64 s'.observed_slot := by
  unfold match_positionsTransition at h; split at h
  · next hg =>
    cases h
    refine ⟨h_valid.1, h_valid.2.1, h_valid.2.2.1, h_valid.2.2.2.1, h_valid.2.2.2.2.1, h_valid.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.1, ?_, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2⟩
    simp only [valid_u64, Valid.valid_u64, Valid.U64_MAX]; omega
  · contradiction

theorem harvest_yield_overflow_safe (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_valid : valid_u8 s.config_initialized ∧ valid_u64 s.market_count ∧ valid_u64 s.position_count ∧ valid_u64 s.lender_count ∧ valid_u64 s.loan_count ∧ valid_u8 s.paused ∧ valid_u8 s.strategy_enabled ∧ valid_u8 s.pending_strategy_enabled ∧ valid_u64 s.strategy_activate_after ∧ valid_u8 s.pending_admin ∧ valid_u64 s.total_yes ∧ valid_u64 s.total_no ∧ valid_u64 s.matched_pairs ∧ valid_u64 s.strategy_principal ∧ valid_u64 s.harvested_yield ∧ valid_u64 s.claimed_yield ∧ valid_u64 s.total_cash ∧ valid_u64 s.total_borrows ∧ valid_u64 s.total_lender_shares ∧ valid_u64 s.collateral_amount ∧ valid_u64 s.bad_debt ∧ valid_u8 s.status ∧ valid_u64 s.next_intent_nonce ∧ valid_u8 s.consumed ∧ valid_u64 s.observed_slot)
    (h_inv_matched_pairs_are_backed : matched_pairs_are_backed s)
    (h_inv_strategy_is_pair_backed : strategy_is_pair_backed s)
    (h_inv_yield_cannot_be_overclaimed : yield_cannot_be_overclaimed s)
    (h_inv_lending_is_conserved : lending_is_conserved s)
    (h : harvest_yieldTransition s signer amount = some s') :
    valid_u8 s'.config_initialized ∧ valid_u64 s'.market_count ∧ valid_u64 s'.position_count ∧ valid_u64 s'.lender_count ∧ valid_u64 s'.loan_count ∧ valid_u8 s'.paused ∧ valid_u8 s'.strategy_enabled ∧ valid_u8 s'.pending_strategy_enabled ∧ valid_u64 s'.strategy_activate_after ∧ valid_u8 s'.pending_admin ∧ valid_u64 s'.total_yes ∧ valid_u64 s'.total_no ∧ valid_u64 s'.matched_pairs ∧ valid_u64 s'.strategy_principal ∧ valid_u64 s'.harvested_yield ∧ valid_u64 s'.claimed_yield ∧ valid_u64 s'.total_cash ∧ valid_u64 s'.total_borrows ∧ valid_u64 s'.total_lender_shares ∧ valid_u64 s'.collateral_amount ∧ valid_u64 s'.bad_debt ∧ valid_u8 s'.status ∧ valid_u64 s'.next_intent_nonce ∧ valid_u8 s'.consumed ∧ valid_u64 s'.observed_slot := by
  unfold harvest_yieldTransition at h; split at h
  · next hg =>
    cases h
    refine ⟨h_valid.1, h_valid.2.1, h_valid.2.2.1, h_valid.2.2.2.1, h_valid.2.2.2.2.1, h_valid.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.1, ?_, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2⟩
    simp only [valid_u64, Valid.valid_u64, Valid.U64_MAX]; omega
  · contradiction

theorem claim_yield_overflow_safe (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_valid : valid_u8 s.config_initialized ∧ valid_u64 s.market_count ∧ valid_u64 s.position_count ∧ valid_u64 s.lender_count ∧ valid_u64 s.loan_count ∧ valid_u8 s.paused ∧ valid_u8 s.strategy_enabled ∧ valid_u8 s.pending_strategy_enabled ∧ valid_u64 s.strategy_activate_after ∧ valid_u8 s.pending_admin ∧ valid_u64 s.total_yes ∧ valid_u64 s.total_no ∧ valid_u64 s.matched_pairs ∧ valid_u64 s.strategy_principal ∧ valid_u64 s.harvested_yield ∧ valid_u64 s.claimed_yield ∧ valid_u64 s.total_cash ∧ valid_u64 s.total_borrows ∧ valid_u64 s.total_lender_shares ∧ valid_u64 s.collateral_amount ∧ valid_u64 s.bad_debt ∧ valid_u8 s.status ∧ valid_u64 s.next_intent_nonce ∧ valid_u8 s.consumed ∧ valid_u64 s.observed_slot)
    (h_inv_matched_pairs_are_backed : matched_pairs_are_backed s)
    (h_inv_strategy_is_pair_backed : strategy_is_pair_backed s)
    (h_inv_yield_cannot_be_overclaimed : yield_cannot_be_overclaimed s)
    (h_inv_lending_is_conserved : lending_is_conserved s)
    (h : claim_yieldTransition s signer amount = some s') :
    valid_u8 s'.config_initialized ∧ valid_u64 s'.market_count ∧ valid_u64 s'.position_count ∧ valid_u64 s'.lender_count ∧ valid_u64 s'.loan_count ∧ valid_u8 s'.paused ∧ valid_u8 s'.strategy_enabled ∧ valid_u8 s'.pending_strategy_enabled ∧ valid_u64 s'.strategy_activate_after ∧ valid_u8 s'.pending_admin ∧ valid_u64 s'.total_yes ∧ valid_u64 s'.total_no ∧ valid_u64 s'.matched_pairs ∧ valid_u64 s'.strategy_principal ∧ valid_u64 s'.harvested_yield ∧ valid_u64 s'.claimed_yield ∧ valid_u64 s'.total_cash ∧ valid_u64 s'.total_borrows ∧ valid_u64 s'.total_lender_shares ∧ valid_u64 s'.collateral_amount ∧ valid_u64 s'.bad_debt ∧ valid_u8 s'.status ∧ valid_u64 s'.next_intent_nonce ∧ valid_u8 s'.consumed ∧ valid_u64 s'.observed_slot := by
  unfold claim_yieldTransition at h; split at h
  · next hg =>
    cases h
    refine ⟨h_valid.1, h_valid.2.1, h_valid.2.2.1, h_valid.2.2.2.1, h_valid.2.2.2.2.1, h_valid.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, ?_, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2⟩
    simp only [valid_u64, Valid.valid_u64, Valid.U64_MAX]; omega
  · contradiction

theorem initialize_lender_overflow_safe (s s' : State) (signer : Pubkey)
    (h_valid : valid_u8 s.config_initialized ∧ valid_u64 s.market_count ∧ valid_u64 s.position_count ∧ valid_u64 s.lender_count ∧ valid_u64 s.loan_count ∧ valid_u8 s.paused ∧ valid_u8 s.strategy_enabled ∧ valid_u8 s.pending_strategy_enabled ∧ valid_u64 s.strategy_activate_after ∧ valid_u8 s.pending_admin ∧ valid_u64 s.total_yes ∧ valid_u64 s.total_no ∧ valid_u64 s.matched_pairs ∧ valid_u64 s.strategy_principal ∧ valid_u64 s.harvested_yield ∧ valid_u64 s.claimed_yield ∧ valid_u64 s.total_cash ∧ valid_u64 s.total_borrows ∧ valid_u64 s.total_lender_shares ∧ valid_u64 s.collateral_amount ∧ valid_u64 s.bad_debt ∧ valid_u8 s.status ∧ valid_u64 s.next_intent_nonce ∧ valid_u8 s.consumed ∧ valid_u64 s.observed_slot)
    (h_inv_matched_pairs_are_backed : matched_pairs_are_backed s)
    (h_inv_strategy_is_pair_backed : strategy_is_pair_backed s)
    (h_inv_yield_cannot_be_overclaimed : yield_cannot_be_overclaimed s)
    (h_inv_lending_is_conserved : lending_is_conserved s)
    (h : initialize_lenderTransition s signer = some s') :
    valid_u8 s'.config_initialized ∧ valid_u64 s'.market_count ∧ valid_u64 s'.position_count ∧ valid_u64 s'.lender_count ∧ valid_u64 s'.loan_count ∧ valid_u8 s'.paused ∧ valid_u8 s'.strategy_enabled ∧ valid_u8 s'.pending_strategy_enabled ∧ valid_u64 s'.strategy_activate_after ∧ valid_u8 s'.pending_admin ∧ valid_u64 s'.total_yes ∧ valid_u64 s'.total_no ∧ valid_u64 s'.matched_pairs ∧ valid_u64 s'.strategy_principal ∧ valid_u64 s'.harvested_yield ∧ valid_u64 s'.claimed_yield ∧ valid_u64 s'.total_cash ∧ valid_u64 s'.total_borrows ∧ valid_u64 s'.total_lender_shares ∧ valid_u64 s'.collateral_amount ∧ valid_u64 s'.bad_debt ∧ valid_u8 s'.status ∧ valid_u64 s'.next_intent_nonce ∧ valid_u8 s'.consumed ∧ valid_u64 s'.observed_slot := by
  unfold initialize_lenderTransition at h; split at h
  · next hg =>
    cases h
    refine ⟨h_valid.1, h_valid.2.1, h_valid.2.2.1, ?_, h_valid.2.2.2.2.1, h_valid.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2⟩
    simp only [valid_u64, Valid.valid_u64, Valid.U64_MAX]; omega
  · contradiction

theorem fund_lending_overflow_safe (s s' : State) (signer : Pubkey) (amount : Nat)
    (h_valid : valid_u8 s.config_initialized ∧ valid_u64 s.market_count ∧ valid_u64 s.position_count ∧ valid_u64 s.lender_count ∧ valid_u64 s.loan_count ∧ valid_u8 s.paused ∧ valid_u8 s.strategy_enabled ∧ valid_u8 s.pending_strategy_enabled ∧ valid_u64 s.strategy_activate_after ∧ valid_u8 s.pending_admin ∧ valid_u64 s.total_yes ∧ valid_u64 s.total_no ∧ valid_u64 s.matched_pairs ∧ valid_u64 s.strategy_principal ∧ valid_u64 s.harvested_yield ∧ valid_u64 s.claimed_yield ∧ valid_u64 s.total_cash ∧ valid_u64 s.total_borrows ∧ valid_u64 s.total_lender_shares ∧ valid_u64 s.collateral_amount ∧ valid_u64 s.bad_debt ∧ valid_u8 s.status ∧ valid_u64 s.next_intent_nonce ∧ valid_u8 s.consumed ∧ valid_u64 s.observed_slot)
    (h_inv_matched_pairs_are_backed : matched_pairs_are_backed s)
    (h_inv_strategy_is_pair_backed : strategy_is_pair_backed s)
    (h_inv_yield_cannot_be_overclaimed : yield_cannot_be_overclaimed s)
    (h_inv_lending_is_conserved : lending_is_conserved s)
    (h : fund_lendingTransition s signer amount = some s') :
    valid_u8 s'.config_initialized ∧ valid_u64 s'.market_count ∧ valid_u64 s'.position_count ∧ valid_u64 s'.lender_count ∧ valid_u64 s'.loan_count ∧ valid_u8 s'.paused ∧ valid_u8 s'.strategy_enabled ∧ valid_u8 s'.pending_strategy_enabled ∧ valid_u64 s'.strategy_activate_after ∧ valid_u8 s'.pending_admin ∧ valid_u64 s'.total_yes ∧ valid_u64 s'.total_no ∧ valid_u64 s'.matched_pairs ∧ valid_u64 s'.strategy_principal ∧ valid_u64 s'.harvested_yield ∧ valid_u64 s'.claimed_yield ∧ valid_u64 s'.total_cash ∧ valid_u64 s'.total_borrows ∧ valid_u64 s'.total_lender_shares ∧ valid_u64 s'.collateral_amount ∧ valid_u64 s'.bad_debt ∧ valid_u8 s'.status ∧ valid_u64 s'.next_intent_nonce ∧ valid_u8 s'.consumed ∧ valid_u64 s'.observed_slot := by
  unfold fund_lendingTransition at h; split at h
  · next hg =>
    cases h
    refine ⟨h_valid.1, h_valid.2.1, h_valid.2.2.1, h_valid.2.2.2.1, h_valid.2.2.2.2.1, h_valid.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, ?_, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, ?_, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2⟩
    simp only [valid_u64, Valid.valid_u64, Valid.U64_MAX]; omega
    simp only [valid_u64, Valid.valid_u64, Valid.U64_MAX]; omega
  · contradiction

theorem initialize_loan_overflow_safe (s s' : State) (signer : Pubkey)
    (h_valid : valid_u8 s.config_initialized ∧ valid_u64 s.market_count ∧ valid_u64 s.position_count ∧ valid_u64 s.lender_count ∧ valid_u64 s.loan_count ∧ valid_u8 s.paused ∧ valid_u8 s.strategy_enabled ∧ valid_u8 s.pending_strategy_enabled ∧ valid_u64 s.strategy_activate_after ∧ valid_u8 s.pending_admin ∧ valid_u64 s.total_yes ∧ valid_u64 s.total_no ∧ valid_u64 s.matched_pairs ∧ valid_u64 s.strategy_principal ∧ valid_u64 s.harvested_yield ∧ valid_u64 s.claimed_yield ∧ valid_u64 s.total_cash ∧ valid_u64 s.total_borrows ∧ valid_u64 s.total_lender_shares ∧ valid_u64 s.collateral_amount ∧ valid_u64 s.bad_debt ∧ valid_u8 s.status ∧ valid_u64 s.next_intent_nonce ∧ valid_u8 s.consumed ∧ valid_u64 s.observed_slot)
    (h_inv_matched_pairs_are_backed : matched_pairs_are_backed s)
    (h_inv_strategy_is_pair_backed : strategy_is_pair_backed s)
    (h_inv_yield_cannot_be_overclaimed : yield_cannot_be_overclaimed s)
    (h_inv_lending_is_conserved : lending_is_conserved s)
    (h : initialize_loanTransition s signer = some s') :
    valid_u8 s'.config_initialized ∧ valid_u64 s'.market_count ∧ valid_u64 s'.position_count ∧ valid_u64 s'.lender_count ∧ valid_u64 s'.loan_count ∧ valid_u8 s'.paused ∧ valid_u8 s'.strategy_enabled ∧ valid_u8 s'.pending_strategy_enabled ∧ valid_u64 s'.strategy_activate_after ∧ valid_u8 s'.pending_admin ∧ valid_u64 s'.total_yes ∧ valid_u64 s'.total_no ∧ valid_u64 s'.matched_pairs ∧ valid_u64 s'.strategy_principal ∧ valid_u64 s'.harvested_yield ∧ valid_u64 s'.claimed_yield ∧ valid_u64 s'.total_cash ∧ valid_u64 s'.total_borrows ∧ valid_u64 s'.total_lender_shares ∧ valid_u64 s'.collateral_amount ∧ valid_u64 s'.bad_debt ∧ valid_u8 s'.status ∧ valid_u64 s'.next_intent_nonce ∧ valid_u8 s'.consumed ∧ valid_u64 s'.observed_slot := by
  unfold initialize_loanTransition at h; split at h
  · next hg =>
    cases h
    refine ⟨h_valid.1, h_valid.2.1, h_valid.2.2.1, h_valid.2.2.2.1, ?_, h_valid.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2⟩
    simp only [valid_u64, Valid.valid_u64, Valid.U64_MAX]; omega
  · contradiction

theorem borrow_overflow_safe (s s' : State) (signer : Pubkey) (amount : Nat) (collateral : Nat)
    (h_valid : valid_u8 s.config_initialized ∧ valid_u64 s.market_count ∧ valid_u64 s.position_count ∧ valid_u64 s.lender_count ∧ valid_u64 s.loan_count ∧ valid_u8 s.paused ∧ valid_u8 s.strategy_enabled ∧ valid_u8 s.pending_strategy_enabled ∧ valid_u64 s.strategy_activate_after ∧ valid_u8 s.pending_admin ∧ valid_u64 s.total_yes ∧ valid_u64 s.total_no ∧ valid_u64 s.matched_pairs ∧ valid_u64 s.strategy_principal ∧ valid_u64 s.harvested_yield ∧ valid_u64 s.claimed_yield ∧ valid_u64 s.total_cash ∧ valid_u64 s.total_borrows ∧ valid_u64 s.total_lender_shares ∧ valid_u64 s.collateral_amount ∧ valid_u64 s.bad_debt ∧ valid_u8 s.status ∧ valid_u64 s.next_intent_nonce ∧ valid_u8 s.consumed ∧ valid_u64 s.observed_slot)
    (h_inv_matched_pairs_are_backed : matched_pairs_are_backed s)
    (h_inv_strategy_is_pair_backed : strategy_is_pair_backed s)
    (h_inv_yield_cannot_be_overclaimed : yield_cannot_be_overclaimed s)
    (h_inv_lending_is_conserved : lending_is_conserved s)
    (h : borrowTransition s signer amount collateral = some s') :
    valid_u8 s'.config_initialized ∧ valid_u64 s'.market_count ∧ valid_u64 s'.position_count ∧ valid_u64 s'.lender_count ∧ valid_u64 s'.loan_count ∧ valid_u8 s'.paused ∧ valid_u8 s'.strategy_enabled ∧ valid_u8 s'.pending_strategy_enabled ∧ valid_u64 s'.strategy_activate_after ∧ valid_u8 s'.pending_admin ∧ valid_u64 s'.total_yes ∧ valid_u64 s'.total_no ∧ valid_u64 s'.matched_pairs ∧ valid_u64 s'.strategy_principal ∧ valid_u64 s'.harvested_yield ∧ valid_u64 s'.claimed_yield ∧ valid_u64 s'.total_cash ∧ valid_u64 s'.total_borrows ∧ valid_u64 s'.total_lender_shares ∧ valid_u64 s'.collateral_amount ∧ valid_u64 s'.bad_debt ∧ valid_u8 s'.status ∧ valid_u64 s'.next_intent_nonce ∧ valid_u8 s'.consumed ∧ valid_u64 s'.observed_slot := by
  unfold borrowTransition at h; split at h
  · next hg =>
    cases h
    refine ⟨h_valid.1, h_valid.2.1, h_valid.2.2.1, h_valid.2.2.2.1, h_valid.2.2.2.2.1, h_valid.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, ?_, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, ?_, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2⟩
    simp only [valid_u64, Valid.valid_u64, Valid.U64_MAX]; omega
    simp only [valid_u64, Valid.valid_u64, Valid.U64_MAX]; omega
  · contradiction

theorem repay_overflow_safe (s s' : State) (signer : Pubkey) (amount : Nat) (collateral : Nat)
    (h_valid : valid_u8 s.config_initialized ∧ valid_u64 s.market_count ∧ valid_u64 s.position_count ∧ valid_u64 s.lender_count ∧ valid_u64 s.loan_count ∧ valid_u8 s.paused ∧ valid_u8 s.strategy_enabled ∧ valid_u8 s.pending_strategy_enabled ∧ valid_u64 s.strategy_activate_after ∧ valid_u8 s.pending_admin ∧ valid_u64 s.total_yes ∧ valid_u64 s.total_no ∧ valid_u64 s.matched_pairs ∧ valid_u64 s.strategy_principal ∧ valid_u64 s.harvested_yield ∧ valid_u64 s.claimed_yield ∧ valid_u64 s.total_cash ∧ valid_u64 s.total_borrows ∧ valid_u64 s.total_lender_shares ∧ valid_u64 s.collateral_amount ∧ valid_u64 s.bad_debt ∧ valid_u8 s.status ∧ valid_u64 s.next_intent_nonce ∧ valid_u8 s.consumed ∧ valid_u64 s.observed_slot)
    (h_inv_matched_pairs_are_backed : matched_pairs_are_backed s)
    (h_inv_strategy_is_pair_backed : strategy_is_pair_backed s)
    (h_inv_yield_cannot_be_overclaimed : yield_cannot_be_overclaimed s)
    (h_inv_lending_is_conserved : lending_is_conserved s)
    (h : repayTransition s signer amount collateral = some s') :
    valid_u8 s'.config_initialized ∧ valid_u64 s'.market_count ∧ valid_u64 s'.position_count ∧ valid_u64 s'.lender_count ∧ valid_u64 s'.loan_count ∧ valid_u8 s'.paused ∧ valid_u8 s'.strategy_enabled ∧ valid_u8 s'.pending_strategy_enabled ∧ valid_u64 s'.strategy_activate_after ∧ valid_u8 s'.pending_admin ∧ valid_u64 s'.total_yes ∧ valid_u64 s'.total_no ∧ valid_u64 s'.matched_pairs ∧ valid_u64 s'.strategy_principal ∧ valid_u64 s'.harvested_yield ∧ valid_u64 s'.claimed_yield ∧ valid_u64 s'.total_cash ∧ valid_u64 s'.total_borrows ∧ valid_u64 s'.total_lender_shares ∧ valid_u64 s'.collateral_amount ∧ valid_u64 s'.bad_debt ∧ valid_u8 s'.status ∧ valid_u64 s'.next_intent_nonce ∧ valid_u8 s'.consumed ∧ valid_u64 s'.observed_slot := by
  unfold repayTransition at h; split at h
  · next hg =>
    cases h
    refine ⟨h_valid.1, h_valid.2.1, h_valid.2.2.1, h_valid.2.2.2.1, h_valid.2.2.2.2.1, h_valid.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, ?_, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2⟩
    simp only [valid_u64, Valid.valid_u64, Valid.U64_MAX]; omega
  · contradiction

theorem liquidate_overflow_safe (s s' : State) (signer : Pubkey)
    (h_valid : valid_u8 s.config_initialized ∧ valid_u64 s.market_count ∧ valid_u64 s.position_count ∧ valid_u64 s.lender_count ∧ valid_u64 s.loan_count ∧ valid_u8 s.paused ∧ valid_u8 s.strategy_enabled ∧ valid_u8 s.pending_strategy_enabled ∧ valid_u64 s.strategy_activate_after ∧ valid_u8 s.pending_admin ∧ valid_u64 s.total_yes ∧ valid_u64 s.total_no ∧ valid_u64 s.matched_pairs ∧ valid_u64 s.strategy_principal ∧ valid_u64 s.harvested_yield ∧ valid_u64 s.claimed_yield ∧ valid_u64 s.total_cash ∧ valid_u64 s.total_borrows ∧ valid_u64 s.total_lender_shares ∧ valid_u64 s.collateral_amount ∧ valid_u64 s.bad_debt ∧ valid_u8 s.status ∧ valid_u64 s.next_intent_nonce ∧ valid_u8 s.consumed ∧ valid_u64 s.observed_slot)
    (h_inv_matched_pairs_are_backed : matched_pairs_are_backed s)
    (h_inv_strategy_is_pair_backed : strategy_is_pair_backed s)
    (h_inv_yield_cannot_be_overclaimed : yield_cannot_be_overclaimed s)
    (h_inv_lending_is_conserved : lending_is_conserved s)
    (h : liquidateTransition s signer = some s') :
    valid_u8 s'.config_initialized ∧ valid_u64 s'.market_count ∧ valid_u64 s'.position_count ∧ valid_u64 s'.lender_count ∧ valid_u64 s'.loan_count ∧ valid_u8 s'.paused ∧ valid_u8 s'.strategy_enabled ∧ valid_u8 s'.pending_strategy_enabled ∧ valid_u64 s'.strategy_activate_after ∧ valid_u8 s'.pending_admin ∧ valid_u64 s'.total_yes ∧ valid_u64 s'.total_no ∧ valid_u64 s'.matched_pairs ∧ valid_u64 s'.strategy_principal ∧ valid_u64 s'.harvested_yield ∧ valid_u64 s'.claimed_yield ∧ valid_u64 s'.total_cash ∧ valid_u64 s'.total_borrows ∧ valid_u64 s'.total_lender_shares ∧ valid_u64 s'.collateral_amount ∧ valid_u64 s'.bad_debt ∧ valid_u8 s'.status ∧ valid_u64 s'.next_intent_nonce ∧ valid_u8 s'.consumed ∧ valid_u64 s'.observed_slot := by
  unfold liquidateTransition at h; split at h
  · next hg =>
    cases h
    refine ⟨h_valid.1, h_valid.2.1, h_valid.2.2.1, h_valid.2.2.2.1, h_valid.2.2.2.2.1, h_valid.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, ?_, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2⟩
    simp only [valid_u64, Valid.valid_u64, Valid.U64_MAX]; omega
  · contradiction

theorem create_agent_intent_overflow_safe (s s' : State) (signer : Pubkey) (nonce : Nat)
    (h_valid : valid_u8 s.config_initialized ∧ valid_u64 s.market_count ∧ valid_u64 s.position_count ∧ valid_u64 s.lender_count ∧ valid_u64 s.loan_count ∧ valid_u8 s.paused ∧ valid_u8 s.strategy_enabled ∧ valid_u8 s.pending_strategy_enabled ∧ valid_u64 s.strategy_activate_after ∧ valid_u8 s.pending_admin ∧ valid_u64 s.total_yes ∧ valid_u64 s.total_no ∧ valid_u64 s.matched_pairs ∧ valid_u64 s.strategy_principal ∧ valid_u64 s.harvested_yield ∧ valid_u64 s.claimed_yield ∧ valid_u64 s.total_cash ∧ valid_u64 s.total_borrows ∧ valid_u64 s.total_lender_shares ∧ valid_u64 s.collateral_amount ∧ valid_u64 s.bad_debt ∧ valid_u8 s.status ∧ valid_u64 s.next_intent_nonce ∧ valid_u8 s.consumed ∧ valid_u64 s.observed_slot)
    (h_inv_matched_pairs_are_backed : matched_pairs_are_backed s)
    (h_inv_strategy_is_pair_backed : strategy_is_pair_backed s)
    (h_inv_yield_cannot_be_overclaimed : yield_cannot_be_overclaimed s)
    (h_inv_lending_is_conserved : lending_is_conserved s)
    (h : create_agent_intentTransition s signer nonce = some s') :
    valid_u8 s'.config_initialized ∧ valid_u64 s'.market_count ∧ valid_u64 s'.position_count ∧ valid_u64 s'.lender_count ∧ valid_u64 s'.loan_count ∧ valid_u8 s'.paused ∧ valid_u8 s'.strategy_enabled ∧ valid_u8 s'.pending_strategy_enabled ∧ valid_u64 s'.strategy_activate_after ∧ valid_u8 s'.pending_admin ∧ valid_u64 s'.total_yes ∧ valid_u64 s'.total_no ∧ valid_u64 s'.matched_pairs ∧ valid_u64 s'.strategy_principal ∧ valid_u64 s'.harvested_yield ∧ valid_u64 s'.claimed_yield ∧ valid_u64 s'.total_cash ∧ valid_u64 s'.total_borrows ∧ valid_u64 s'.total_lender_shares ∧ valid_u64 s'.collateral_amount ∧ valid_u64 s'.bad_debt ∧ valid_u8 s'.status ∧ valid_u64 s'.next_intent_nonce ∧ valid_u8 s'.consumed ∧ valid_u64 s'.observed_slot := by
  unfold create_agent_intentTransition at h; split at h
  · next hg =>
    cases h
    refine ⟨h_valid.1, h_valid.2.1, h_valid.2.2.1, h_valid.2.2.2.1, h_valid.2.2.2.2.1, h_valid.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, ?_, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.1, h_valid.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2.2⟩
    simp only [valid_u64, Valid.valid_u64, Valid.U64_MAX]; omega
  · contradiction

end BeRightCapital
