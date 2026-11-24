import {
  STRIPE_THREE_DECIMAL_CURRENCIES,
  STRIPE_ZERO_DECIMAL_CURRENCIES,
  TEXT,
} from "../constants.js";

/**
 * Convert a major-unit amount to the integer Stripe expects for a currency.
 * Three-decimal currencies (for example KWD) are rounded to a multiple of 10,
 * as Stripe requires. Zero-decimal currencies (for example JPY) are not scaled.
 * Uses the same rules as the EDS `stripe-shared` helpers and the App Builder actions.
 *
 * @param {number|string} value Amount in major currency units.
 * @param {string} currency ISO currency code.
 * @returns {number} Amount in Stripe minor units.
 */
export function toStripeMinorUnits(value, currency) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new Error(TEXT.cartTotalUnavailable);
  }

  const normalizedCurrency = String(currency || "").toUpperCase();
  if (STRIPE_ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency)) {
    return Math.round(numericValue);
  }
  if (STRIPE_THREE_DECIMAL_CURRENCIES.has(normalizedCurrency)) {
    return Math.round(numericValue * 100) * 10;
  }
  return Math.round(numericValue * 100);
}
