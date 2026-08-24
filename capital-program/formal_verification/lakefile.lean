import Lake
open Lake DSL

package beright_capitalProofs

require qedgenSupport from
  "./lean_solana"

@[default_target]
lean_lib Beright_capitalSpec where
  roots := #[`Spec, `Proofs]
