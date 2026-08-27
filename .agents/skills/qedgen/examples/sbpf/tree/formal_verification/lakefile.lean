import Lake
open Lake DSL

package treeProofs

require qedgenSupport from
  "../../../../lean_solana"

lean_lib TreeProg where
  roots := #[`Program]

@[default_target]
lean_lib TreeSpec where
  roots := #[`Spec]
