use anchor_lang::prelude::*;
use crate::errors::StakingPoolError;

/// Safe checked addition
pub fn checked_add(a: u64, b: u64) -> Result<u64> {
    a.checked_add(b)
        .ok_or(StakingPoolError::Overflow.into())
}

/// Safe checked subtraction
pub fn checked_sub(a: u64, b: u64) -> Result<u64> {
    a.checked_sub(b)
        .ok_or(StakingPoolError::Overflow.into())
}

/// Safe checked multiplication
pub fn checked_mul(a: u64, b: u64) -> Result<u64> {
    a.checked_mul(b)
        .ok_or(StakingPoolError::Overflow.into())
}

/// Safe checked division
pub fn checked_div(a: u64, b: u64) -> Result<u64> {
    if b == 0 {
        return Err(StakingPoolError::Overflow.into());
    }
    a.checked_div(b)
        .ok_or(StakingPoolError::Overflow.into())
}

/// Calculate percentage (bps)
/// result = amount * bps / 10000
pub fn calculate_bps(amount: u64, bps: u16) -> Result<u64> {
    checked_div(
        checked_mul(amount, bps as u64)?,
        10000,
    )
}

/// Safe signed addition
pub fn checked_add_i64(a: i64, b: i64) -> Result<i64> {
    a.checked_add(b)
        .ok_or(StakingPoolError::Overflow.into())
}

/// Safe signed subtraction
pub fn checked_sub_i64(a: i64, b: i64) -> Result<i64> {
    a.checked_sub(b)
        .ok_or(StakingPoolError::Overflow.into())
}

/// Convert u64 to i64 safely
pub fn to_i64(value: u64) -> Result<i64> {
    i64::try_from(value)
        .map_err(|_| StakingPoolError::Overflow.into())
}

/// Convert i64 to u64 safely (must be non-negative)
pub fn to_u64(value: i64) -> Result<u64> {
    if value < 0 {
        return Err(StakingPoolError::Overflow.into());
    }
    Ok(value as u64)
}

/// Calculate minimum of two values
pub fn min(a: u64, b: u64) -> u64 {
    if a < b { a } else { b }
}

/// Calculate maximum of two values
pub fn max(a: u64, b: u64) -> u64 {
    if a > b { a } else { b }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_checked_add() {
        assert_eq!(checked_add(1, 2).unwrap(), 3);
        assert!(checked_add(u64::MAX, 1).is_err());
    }

    #[test]
    fn test_checked_sub() {
        assert_eq!(checked_sub(5, 3).unwrap(), 2);
        assert!(checked_sub(3, 5).is_err());
    }

    #[test]
    fn test_calculate_bps() {
        // 10% of 1000
        assert_eq!(calculate_bps(1000, 1000).unwrap(), 100);
        // 1% of 10000
        assert_eq!(calculate_bps(10000, 100).unwrap(), 100);
        // 0.5% of 10000
        assert_eq!(calculate_bps(10000, 50).unwrap(), 50);
    }
}
