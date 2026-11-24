import {
  CONSOLE,
  ESTIMATE_SHIPPING_METHODS,
  LOG,
  SEPARATOR,
  SET_SHIPPING_ADDRESS,
  SET_SHIPPING_METHOD,
  TEXT,
} from "../constants.js";
import { state } from "./state.js";
import { log } from "./logging.js";
import { commerceGraphql } from "./config.js";
import { toStripeMinorUnits } from "./money.js";
import {
  isCompleteWalletAddress,
  toCommerceAddress,
  toWalletAddress,
} from "./wallet-address.js";
import {
  getCartMoney,
  getSelectedShippingMethod,
  getShippingAddress,
  isCompleteCommerceAddress,
  refreshCart,
} from "./cart.js";

export function getShippingMethods(cart = state.cart) {
  return getShippingAddress(cart)?.available_shipping_methods || [];
}

export function getShippingMethodRateId(method) {
  return `${encodeURIComponent(method.carrier_code)}${SEPARATOR.COLON}${encodeURIComponent(method.method_code)}`;
}

export function toStripeShippingRate(method) {
  const amount =
    method.amount || method.price_incl_tax || method.price_excl_tax;
  if (
    !method?.carrier_code ||
    !method?.method_code ||
    !amount ||
    !Number.isFinite(Number(amount.value))
  ) {
    return null;
  }

  const id = getShippingMethodRateId(method);
  state.shippingMethodsByRateId.set(id, method);
  return {
    id,
    displayName:
      [method.carrier_title, method.method_title]
        .filter(Boolean)
        .join(SEPARATOR.EM_DASH) || method.method_code,
    amount: toStripeMinorUnits(
      amount.value,
      amount.currency || state.cart?.prices?.grand_total?.currency
    ),
  };
}

export function setAvailableShippingMethods(methods = []) {
  state.shippingMethodsByRateId = new Map();
  state.currentShippingRates = methods
    .map(toStripeShippingRate)
    .filter(Boolean);
  return state.currentShippingRates;
}

export function getSelectedShippingAmountCents(cart = state.cart) {
  const method = getSelectedShippingMethod(cart);
  if (!method) {
    return 0;
  }
  const amount =
    method.amount || method.price_incl_tax || method.price_excl_tax;
  const value = Number(amount?.value);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return toStripeMinorUnits(
    value,
    amount.currency || cart?.prices?.grand_total?.currency
  );
}

export function getAmountWithShippingRate(shippingRate) {
  const money = getCartMoney();
  const rateAmount = Number(shippingRate?.amount);
  const shippingCents = Number.isFinite(rateAmount) ? rateAmount : 0;
  return money.amount - getSelectedShippingAmountCents() + shippingCents;
}

export async function previewWalletAmount(shippingRate) {
  if (!state.elements || !shippingRate) {
    return state.currentAmount;
  }
  const previewAmount = getAmountWithShippingRate(shippingRate);
  if (previewAmount === state.currentAmount) {
    return previewAmount;
  }
  await state.elements.update({ amount: previewAmount });
  state.currentAmount = previewAmount;
  return previewAmount;
}

/**
 * Save the wallet shipping address on the cart. The street is sent as one line:
 * on the Adobe Commerce SaaS sandbox, placeOrder fails with UNABLE_TO_PLACE_ORDER
 * whenever the shipping address has a second street line (verified 2026-11-24;
 * the billing address is not affected and keeps its lines).
 * @param {Object} walletAddress Wallet address in Stripe's shape.
 * @param {string} [phone] Phone number from the wallet.
 */
export async function setShippingAddress(walletAddress, phone) {
  const address = toCommerceAddress(walletAddress, phone);
  await commerceGraphql(SET_SHIPPING_ADDRESS, {
    cartId: state.cartId,
    shippingAddress: {
      address: { ...address, street: [address.street.join(SEPARATOR.COMMA)] },
    },
  });
  state.walletShippingAddressPersisted = true;
}

export async function estimateShippingMethods(address) {
  const data = await commerceGraphql(ESTIMATE_SHIPPING_METHODS, {
    cartId: state.cartId,
    address: {
      country_code: address.country,
      ...(address.postal_code ? { postcode: address.postal_code } : {}),
      ...(address.state ? { region: { region_code: address.state } } : {}),
    },
  });
  return data?.estimateShippingMethods || [];
}

export async function setShippingMethod(method) {
  await commerceGraphql(SET_SHIPPING_METHOD, {
    cartId: state.cartId,
    shippingMethods: [
      {
        carrier_code: method.carrier_code,
        method_code: method.method_code,
      },
    ],
  });
}

export async function handleShippingAddressChange(event) {
  try {
    let methods = [];
    const walletAddress = toWalletAddress({
      name: event.name,
      address: event.address,
      phone: event.phone || event.phoneNumber,
    });
    if (isCompleteWalletAddress(walletAddress)) {
      await setShippingAddress(walletAddress, walletAddress.phone);
      await refreshCart({ synchronizeElement: false });
      methods = getShippingMethods();
    }

    if (methods.length === 0 && event.address) {
      const estimateAddress =
        toWalletAddress({ address: event.address })?.address || event.address;
      methods = await estimateShippingMethods(estimateAddress);
    }
    const shippingRates = setAvailableShippingMethods(methods);
    if (shippingRates[0] && !state.walletShippingAddressPersisted) {
      await previewWalletAmount(shippingRates[0]);
    }
    event.resolve({ shippingRates });
    log(LOG.shippingAddressChange, {
      persisted: state.walletShippingAddressPersisted,
      shippingRates,
      amount: state.currentAmount,
    });
  } catch (error) {
    console.warn(CONSOLE.processShippingAddressFailed, error);
    event.reject();
    log(LOG.shippingAddressError, { message: error.message });
  }
}

export async function handleShippingRateChange(event) {
  try {
    const method = state.shippingMethodsByRateId.get(event.shippingRate?.id);
    if (!method) {
      event.reject();
      return;
    }

    state.pendingShippingMethod = method;
    if (
      state.walletShippingAddressPersisted ||
      isCompleteCommerceAddress(getShippingAddress())
    ) {
      await setShippingMethod(method);
      await refreshCart({ synchronizeElement: false });
      const money = getCartMoney();
      if (money.currency !== state.currentCurrency) {
        throw new Error(TEXT.cartCurrencyChanged);
      }
      if (money.amount !== state.currentAmount) {
        await state.elements.update({ amount: money.amount });
        state.currentAmount = money.amount;
      }
    } else {
      await previewWalletAmount(event.shippingRate);
    }

    event.resolve({ shippingRates: state.currentShippingRates });
    log(LOG.shippingRateChange, {
      carrierCode: method.carrier_code,
      methodCode: method.method_code,
      amount: state.currentAmount,
    });
  } catch (error) {
    console.warn(CONSOLE.persistShippingMethodFailed, error);
    event.reject();
    log(LOG.shippingRateError, { message: error.message });
  }
}
