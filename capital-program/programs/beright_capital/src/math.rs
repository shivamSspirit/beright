use anchor_lang::prelude::*;

use crate::{
    errors::CapitalError,
    state::{BPS_DENOMINATOR, PRICE_SCALE, REWARD_SCALE},
};

pub fn checked_mul_div(a: u64, b: u64, denominator: u64) -> Result<u64> {
    require!(denominator > 0, CapitalError::InvalidAmount);
    let result = u128::from(a)
        .checked_mul(u128::from(b))
        .ok_or(CapitalError::MathOverflow)?
        .checked_div(u128::from(denominator))
        .ok_or(CapitalError::MathOverflow)?;
    u64::try_from(result).map_err(|_| error!(CapitalError::MathOverflow))
}

pub fn checked_mul_div_ceil(a: u64, b: u64, denominator: u64) -> Result<u64> {
    require!(denominator > 0, CapitalError::InvalidAmount);
    let numerator = u128::from(a)
        .checked_mul(u128::from(b))
        .ok_or(CapitalError::MathOverflow)?;
    let denominator = u128::from(denominator);
    let result = numerator
        .checked_add(
            denominator
                .checked_sub(1)
                .ok_or(CapitalError::MathOverflow)?,
        )
        .ok_or(CapitalError::MathOverflow)?
        .checked_div(denominator)
        .ok_or(CapitalError::MathOverflow)?;
    u64::try_from(result).map_err(|_| error!(CapitalError::MathOverflow))
}

pub fn conservative_price(executable_bid: u64, twap: u64, haircut_bps: u16) -> Result<u64> {
    require!(
        executable_bid <= PRICE_SCALE && twap <= PRICE_SCALE,
        CapitalError::InvalidAmount
    );
    require!(
        u64::from(haircut_bps) <= BPS_DENOMINATOR,
        CapitalError::InvalidAmount
    );
    checked_mul_div(
        executable_bid.min(twap),
        BPS_DENOMINATOR - u64::from(haircut_bps),
        BPS_DENOMINATOR,
    )
}

pub fn collateral_value(amount: u64, price: u64) -> Result<u64> {
    checked_mul_div(amount, price, PRICE_SCALE)
}

pub fn max_borrow(collateral_value: u64, max_ltv_bps: u16) -> Result<u64> {
    checked_mul_div(collateral_value, u64::from(max_ltv_bps), BPS_DENOMINATOR)
}

pub fn is_liquidatable(debt: u64, collateral_value: u64, liquidation_ltv_bps: u16) -> Result<bool> {
    Ok(debt > max_borrow(collateral_value, liquidation_ltv_bps)?)
}

pub fn accrue_reward(
    matched_units: u64,
    current_index_x64: u128,
    paid_index_x64: u128,
) -> Result<u64> {
    let delta = current_index_x64
        .checked_sub(paid_index_x64)
        .ok_or(CapitalError::MathOverflow)?;
    let accrued = u128::from(matched_units)
        .checked_mul(delta)
        .ok_or(CapitalError::MathOverflow)?
        .checked_div(REWARD_SCALE)
        .ok_or(CapitalError::MathOverflow)?;
    u64::try_from(accrued).map_err(|_| error!(CapitalError::MathOverflow))
}

pub fn reward_index_increment(
    yield_amount: u64,
    matched_units: u64,
    dust_x64: u128,
) -> Result<(u128, u128)> {
    require!(matched_units > 0, CapitalError::InsufficientMatched);
    let scaled = u128::from(yield_amount)
        .checked_mul(REWARD_SCALE)
        .and_then(|value| value.checked_add(dust_x64))
        .ok_or(CapitalError::MathOverflow)?;
    let units = u128::from(matched_units);
    Ok((scaled / units, scaled % units))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reward_is_split_by_matched_units() {
        let (increment, dust) = reward_index_increment(100, 2, 0).unwrap();
        assert_eq!(dust, 0);
        assert_eq!(accrue_reward(1, increment, 0).unwrap(), 50);
    }

    #[test]
    fn reward_rounding_dust_is_carried_forward() {
        let (first_increment, first_dust) = reward_index_increment(1, 3, 0).unwrap();
        let (second_increment, second_dust) = reward_index_increment(2, 3, first_dust).unwrap();
        assert_eq!(second_dust, 0);
        assert_eq!(
            accrue_reward(3, first_increment + second_increment, 0).unwrap(),
            3
        );
    }

    #[test]
    fn conservative_price_uses_lower_quote_and_haircut() {
        assert_eq!(
            conservative_price(700_000, 650_000, 2_000).unwrap(),
            520_000
        );
    }

    #[test]
    fn liquidation_boundary_is_strict() {
        assert!(!is_liquidatable(700, 1_000, 7_000).unwrap());
        assert!(is_liquidatable(701, 1_000, 7_000).unwrap());
    }

    #[test]
    fn ceiling_division_never_undercharges() {
        assert_eq!(checked_mul_div_ceil(10, 10, 6).unwrap(), 17);
    }

    #[test]
    fn multiplication_overflow_fails_closed() {
        assert!(checked_mul_div(u64::MAX, u64::MAX, 1).is_err());
    }
}
