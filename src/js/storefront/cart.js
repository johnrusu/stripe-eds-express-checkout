import {
  BADGE_STATE,
  CART_STORAGE_KEY,
  CREATE_GUEST_CART,
  EMPTY_DISPLAY,
  GET_CUSTOMER_CART,
  GET_GUEST_CART,
  LOG,
  NUMBER_FORMAT,
  RUNTIME_PATH,
  SEPARATOR,
  STRIPE_PAYMENT_METHOD_CODE,
  STRIPE_PAYMENT_STATUS,
  TEXT,
} from "../constants.js";
import { notifyWarning } from "../notifications.js";
import { dom } from "./dom.js";
import { toStripeMinorUnits } from "./money.js";
import { state } from "./state.js";
import { log, setBadge } from "./logging.js";
import { commerceGraphql, getConfig } from "./config.js";
import { persistCartId, setConnected } from "./session.js";
import {
  destroyExpressCheckout,
  hideExpressCheckout,
  synchronizeExpressCheckout,
} from "./express-checkout.js";

export function getStripePaymentMethod(cart = state.cart) {
  return [
    cart?.selected_payment_method,
    ...(cart?.available_payment_methods || []),
  ].find((method) => method?.code === STRIPE_PAYMENT_METHOD_CODE);
}

export function discoverRuntimeConfig(cart = state.cart) {
  const config = getConfig();
  if (config.runtimeBaseUrl) {
    return {
      createPaymentIntentUrl: `${config.runtimeBaseUrl}${RUNTIME_PATH.PAYMENT_INTENT}`,
      getInitParamsUrl: `${config.runtimeBaseUrl}${RUNTIME_PATH.INIT_PARAMS}`,
    };
  }

  const encodedConfig =
    getStripePaymentMethod(cart)?.oope_payment_method_config
      ?.backend_integration_url;
  if (!encodedConfig) {
    throw new Error(TEXT.runtimeMissing);
  }

  const runtimeConfig = JSON.parse(encodedConfig);
  if (
    !runtimeConfig.getInitParamsUrl ||
    !runtimeConfig.createPaymentIntentUrl
  ) {
    throw new Error(TEXT.runtimeMissing);
  }
  return runtimeConfig;
}

export async function createOrLoadCart() {
  const config = getConfig();
  hideOrderSuccess();
  setBadge(dom.cartStatus, TEXT.loading, BADGE_STATE.LOADING);

  if (config.customerToken) {
    const data = await commerceGraphql(GET_CUSTOMER_CART);
    if (!data?.cart?.id) {
      throw new Error(TEXT.cartMissing);
    }
    persistCartId(data.cart.id);
    state.cart = data.cart;
  } else if (dom.cartId.value.trim()) {
    persistCartId(dom.cartId.value.trim());
  } else {
    const data = await commerceGraphql(CREATE_GUEST_CART);
    const cartId = data?.createGuestCart?.cart?.id;
    if (!cartId) {
      throw new Error(TEXT.cartMissing);
    }
    persistCartId(cartId);
  }

  await refreshCart();
}

export async function fetchCart() {
  const config = getConfig();
  if (config.customerToken) {
    const data = await commerceGraphql(GET_CUSTOMER_CART);
    if (data?.cart?.id && data.cart.id !== state.cartId) {
      persistCartId(data.cart.id);
    }
    return data?.cart || null;
  }

  const cartId = dom.cartId.value.trim() || state.cartId;
  if (!cartId) {
    throw new Error(TEXT.cartMissing);
  }
  persistCartId(cartId);
  const data = await commerceGraphql(GET_GUEST_CART, { cartId });
  return data?.cart || null;
}

export function getCartMoney(cart = state.cart) {
  const money = cart?.prices?.grand_total;
  if (!money || !Number.isFinite(Number(money.value)) || !money.currency) {
    throw new Error(TEXT.cartTotalUnavailable);
  }
  return {
    amount: toStripeMinorUnits(money.value, money.currency),
    currency: String(money.currency).toLowerCase(),
  };
}

export function formatMoney(money) {
  if (!money) {
    return EMPTY_DISPLAY;
  }
  try {
    return new Intl.NumberFormat(undefined, {
      currency: money.currency,
      style: NUMBER_FORMAT.STYLE_CURRENCY,
    }).format(Number(money.value));
  } catch {
    return `${money.value} ${money.currency}`;
  }
}

export function getShippingAddress(cart = state.cart) {
  return cart?.shipping_addresses?.[0] || null;
}

export function getSelectedShippingMethod(cart = state.cart) {
  return getShippingAddress(cart)?.selected_shipping_method || null;
}

export function isCompleteCommerceAddress(address) {
  return Boolean(
    address?.firstname &&
    address?.lastname &&
    address?.street?.[0] &&
    address?.city &&
    address?.country?.code &&
    address?.postcode
  );
}

export function isCompleteBillingAddress(cart = state.cart) {
  return isCompleteCommerceAddress(cart?.billing_address);
}

export function shouldCollectShipping(cart = state.cart) {
  if (cart?.is_virtual) {
    return false;
  }
  return !(
    isCompleteCommerceAddress(getShippingAddress(cart)) &&
    getSelectedShippingMethod(cart)
  );
}

export function cartNeedsWalletAddresses() {
  return (
    (shouldCollectShipping() &&
      !isCompleteCommerceAddress(getShippingAddress())) ||
    !isCompleteBillingAddress()
  );
}

export function renderCartSummary() {
  const cart = state.cart;
  const shippingAddress = getShippingAddress(cart);
  const shippingMethod = getSelectedShippingMethod(cart);
  const isAuthenticated = Boolean(dom.customerToken.value.trim());

  setBadge(
    dom.cartStatus,
    cart?.id ? TEXT.cartLoaded : TEXT.noCart,
    cart?.id ? BADGE_STATE.SUCCESS : ""
  );
  dom.summaryCustomer.textContent = isAuthenticated
    ? TEXT.customerRegistered
    : cart?.email
      ? TEXT.guestWithEmail(cart.email)
      : TEXT.guest;
  dom.summaryTotal.textContent = formatMoney(cart?.prices?.grand_total);
  dom.summaryShippingAddress.textContent = shippingAddress
    ? [shippingAddress.street?.[0], shippingAddress.city]
        .filter(Boolean)
        .join(SEPARATOR.COMMA) || TEXT.available
    : TEXT.missing;
  dom.summaryShippingMethod.textContent = shippingMethod
    ? [shippingMethod.carrier_title, shippingMethod.method_title]
        .filter(Boolean)
        .join(SEPARATOR.EM_DASH)
    : TEXT.missing;
  dom.summaryStripe.textContent = getStripePaymentMethod(cart)
    ? TEXT.available
    : TEXT.notAvailable;
  dom.summaryCapture.textContent =
    state.initParams?.elementsOptions?.captureMethod || EMPTY_DISPLAY;
}

export function hideOrderSuccess() {
  dom.orderSuccess.hidden = true;
  dom.orderSuccessMessage.textContent = "";
  dom.paymentContent.hidden = false;
}

export function showOrderSuccess(order, paymentIntentStatus) {
  dom.orderSuccessTitle.textContent =
    paymentIntentStatus === STRIPE_PAYMENT_STATUS.REQUIRES_CAPTURE
      ? TEXT.paymentAuthorized
      : TEXT.paymentSuccessful;
  dom.orderSuccessMessage.textContent = TEXT.orderConfirmed(order?.number);
  dom.paymentContent.hidden = true;
  dom.orderSuccess.hidden = false;
}

export async function refreshCart({ synchronizeElement = true } = {}) {
  setBadge(dom.cartStatus, TEXT.loading, BADGE_STATE.LOADING);
  const cart = await fetchCart();
  if (!cart) {
    throw new Error(TEXT.cartMissing);
  }

  state.cart = cart;
  state.runtimeConfig = getStripePaymentMethod(cart)
    ? discoverRuntimeConfig(cart)
    : null;
  renderCartSummary();
  log(LOG.cartRefreshed, {
    cartId: cart.id,
    total: cart.prices?.grand_total,
  });

  if (synchronizeElement) {
    await synchronizeExpressCheckout();
  }
  return cart;
}

export function clearCartSession() {
  window.sessionStorage.removeItem(CART_STORAGE_KEY);
  persistCartId(null);
  state.cart = null;
  destroyExpressCheckout();
  hideExpressCheckout();
  hideOrderSuccess();
  setBadge(dom.cartStatus, TEXT.noCart);
  renderCartSummary();
}

export function handleCommerceUrlChange() {
  if (!state.connected || !state.connectedCommerceUrl) {
    return;
  }

  const previousCommerceUrl = state.connectedCommerceUrl;
  const nextUrl = dom.commerceUrl.value.trim();
  if (nextUrl === previousCommerceUrl) {
    return;
  }

  const hadCart = Boolean(state.cartId || state.cart);
  clearCartSession();
  setConnected(false);
  setBadge(dom.connectionStatus, TEXT.notConnected);
  log(LOG.commerceUrlChanged, {
    previousCommerceUrl,
    commerceUrl: nextUrl,
    clearedCart: hadCart,
  });
  notifyWarning(
    hadCart
      ? TEXT.commerceUrlChangedWithCart
      : TEXT.commerceUrlChangedWithoutCart
  );
}
