/* global Stripe */

import { ARIA, BADGE_STATE, CONSOLE, CSS_CLASS, LOG, SELECTOR, STRIPE, TEXT } from "../constants.js";
import { dom } from "./dom.js";
import { state } from "./state.js";
import { log, setBadge } from "./logging.js";
import {
  discoverRuntimeConfig,
  getCartMoney,
  getStripePaymentMethod,
  isCompleteBillingAddress,
  renderCartSummary,
  shouldCollectShipping,
} from "./cart.js";
import {
  getShippingMethods,
  handleShippingAddressChange,
  handleShippingRateChange,
  previewWalletAmount,
  setAvailableShippingMethods,
} from "./shipping.js";
import { handleConfirm } from "./payment.js";

export function getExpressCheckoutOptions() {
  const collectShipping = shouldCollectShipping();
  const options = {
    billingAddressRequired: !isCompleteBillingAddress(),
    emailRequired: !state.cart?.email,
    phoneNumberRequired: collectShipping,
    shippingAddressRequired: collectShipping,
  };

  if (collectShipping) {
    options.shippingRates = setAvailableShippingMethods(getShippingMethods());
  } else {
    setAvailableShippingMethods([]);
  }
  return options;
}

export function getConfigurationKey() {
  const options = getExpressCheckoutOptions();
  return JSON.stringify({
    billingAddressRequired: options.billingAddressRequired,
    cartId: state.cart?.id,
    emailRequired: options.emailRequired,
    phoneNumberRequired: options.phoneNumberRequired,
    shippingAddressRequired: options.shippingAddressRequired,
  });
}

/**
 * Load Stripe.js init payload from App Builder `GET {base}/init-params`.
 * Requires `publishableKey`. Optional `options`, `appInfo`, and
 * `elementsOptions` are applied when mounting deferred ECE (mode payment).
 * A Payment Element `clientSecret` from this payload is not used.
 *
 * @returns {Promise<{ publishableKey: string, options?: object, appInfo?: object, elementsOptions?: object }>}
 */
export async function fetchInitParams() {
  const response = await fetch(state.runtimeConfig.getInitParamsUrl);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.publishableKey) {
    throw new Error(TEXT.initializationFailed);
  }
  return data;
}

export function destroyExpressCheckout() {
  if (state.expressCheckoutElement) {
    try {
      state.expressCheckoutElement.destroy();
    } catch (error) {
      console.warn(CONSOLE.destroyExpressCheckoutFailed, error);
    }
  }
  state.configurationKey = null;
  state.currentAmount = null;
  state.currentCurrency = null;
  state.currentShippingRates = [];
  state.elementLoadFailed = false;
  state.elements = null;
  state.expressCheckoutElement = null;
  state.initParams = null;
  state.pendingShippingMethod = null;
  state.shippingMethodsByRateId = new Map();
  state.stripe = null;
  state.walletReauthorizationRequired = false;
  state.walletShippingAddressPersisted = false;
}

export function hideExpressCheckout(message = null) {
  dom.expressCheckoutSection.classList.add(CSS_CLASS.HIDDEN);
  dom.wallet.classList.remove(CSS_CLASS.OPACITY_25);
  if (message) {
    setBadge(dom.paymentStatus, message, BADGE_STATE.ERROR);
  }
}

export function showExpressCheckout() {
  if (state.elementLoadFailed) {
    return;
  }
  dom.expressCheckoutSection.classList.remove(CSS_CLASS.HIDDEN);
  dom.wallet.classList.remove(CSS_CLASS.OPACITY_25);
  setBadge(dom.paymentStatus, TEXT.ready, BADGE_STATE.SUCCESS);
}

export function setCheckoutBlocked(blocked) {
  dom.blocker.hidden = !blocked;
  document.body.setAttribute(ARIA.BUSY, String(blocked));
}

export function handleModalDismissed() {
  const wasOpen = state.modalOpen || !dom.blocker.hidden;
  state.modalOpen = false;
  if (!state.confirmationInProgress) {
    setCheckoutBlocked(false);
    if (wasOpen) {
      log(LOG.walletDismissed);
    }
    synchronizeExpressCheckout();
  }
}

function registerExpressCheckoutHandlers() {
  state.expressCheckoutElement.on(STRIPE.EVENT.CLICK, (event) => {
    state.modalOpen = true;
    state.walletReauthorizationRequired = false;
    setCheckoutBlocked(true);
    const rates = state.currentShippingRates;
    const resolveClick = () => {
      log(LOG.walletClicked, {
        cartId: state.cartId,
        amount: state.currentAmount,
        currency: state.currentCurrency,
        expressPaymentType: event.expressPaymentType,
      });
      event.resolve({ shippingRates: rates });
    };
    if (!shouldCollectShipping() || !rates[0]) {
      resolveClick();
      return;
    }
    previewWalletAmount(rates[0])
      .then(resolveClick)
      .catch((error) => {
        console.warn(CONSOLE.previewWalletAmountFailed, error);
        resolveClick();
      });
  });
  state.expressCheckoutElement.on(STRIPE.EVENT.CONFIRM, handleConfirm);
  state.expressCheckoutElement.on(
    STRIPE.EVENT.SHIPPING_ADDRESS_CHANGE,
    handleShippingAddressChange
  );
  state.expressCheckoutElement.on(
    STRIPE.EVENT.SHIPPING_RATE_CHANGE,
    handleShippingRateChange
  );
  state.expressCheckoutElement.on(STRIPE.EVENT.CANCEL, handleModalDismissed);
  state.expressCheckoutElement.on(STRIPE.EVENT.ESCAPE, handleModalDismissed);
  state.expressCheckoutElement.on(STRIPE.EVENT.LOAD_ERROR, (event) => {
    console.warn(CONSOLE.expressCheckoutLoadFailed, event.error);
    state.elementLoadFailed = true;
    log(LOG.walletLoadError, {
      message: event.error?.message,
      type: event.error?.type,
      code: event.error?.code,
    });
    handleModalDismissed();
    hideExpressCheckout();
  });
  state.expressCheckoutElement.on(STRIPE.EVENT.READY, (event) => {
    if (event.availablePaymentMethods) {
      log(LOG.walletReady, {
        availablePaymentMethods: event.availablePaymentMethods,
      });
      showExpressCheckout();
    } else {
      log(LOG.walletUnavailable, { reason: TEXT.walletUnavailable });
      hideExpressCheckout(TEXT.walletUnavailable);
    }
  });
  state.expressCheckoutElement.on(
    STRIPE.EVENT.AVAILABLE_PAYMENT_METHODS_CHANGE,
    (event) => {
      if (event.paymentMethods) {
        log(LOG.walletPaymentMethodsChanged, {
          paymentMethods: event.paymentMethods,
        });
        showExpressCheckout();
      } else {
        log(LOG.walletUnavailable, { reason: TEXT.walletUnavailable });
        hideExpressCheckout(TEXT.walletUnavailable);
      }
    }
  );
}

export async function mountExpressCheckout() {
  if (!state.cart || !getStripePaymentMethod()) {
    hideExpressCheckout(TEXT.stripeMissing);
    return;
  }

  destroyExpressCheckout();
  dom.wallet.classList.add(CSS_CLASS.OPACITY_25);
  dom.expressCheckoutSection.classList.remove(CSS_CLASS.HIDDEN);
  setBadge(dom.paymentStatus, TEXT.loading, BADGE_STATE.LOADING);

  try {
    state.runtimeConfig = discoverRuntimeConfig();
    state.initParams = await fetchInitParams();
    state.stripe = Stripe(
      state.initParams.publishableKey,
      state.initParams.options
    );
    if (state.initParams.appInfo) {
      state.stripe.registerAppInfo(state.initParams.appInfo);
    }

    const money = getCartMoney();
    const elementsOptions = {
      mode: STRIPE.ELEMENTS_MODE,
      amount: money.amount,
      currency: money.currency,
      ...(state.initParams.elementsOptions?.captureMethod
        ? {
            captureMethod: state.initParams.elementsOptions.captureMethod,
          }
        : {}),
      ...(state.initParams.elementsOptions?.paymentMethodOptions
        ? {
            paymentMethodOptions:
              state.initParams.elementsOptions.paymentMethodOptions,
          }
        : {}),
    };
    state.currentAmount = money.amount;
    state.currentCurrency = money.currency;
    state.elements = state.stripe.elements(elementsOptions);
    state.expressCheckoutElement = state.elements.create(
      STRIPE.ELEMENT_TYPE,
      getExpressCheckoutOptions()
    );
    registerExpressCheckoutHandlers();
    state.expressCheckoutElement.mount(SELECTOR.wallet);
    state.configurationKey = getConfigurationKey();
    renderCartSummary();
    log(LOG.stripeMounted, elementsOptions);
  } catch (error) {
    console.warn(TEXT.initializationFailed, error);
    hideExpressCheckout(TEXT.initializationFailed);
    log(LOG.stripeInitializationError, { message: error.message });
  }
}

export async function synchronizeExpressCheckout() {
  if (state.modalOpen || state.confirmationInProgress) {
    return;
  }
  if (!state.cart || !getStripePaymentMethod()) {
    destroyExpressCheckout();
    hideExpressCheckout();
    return;
  }
  if (!state.expressCheckoutElement) {
    await mountExpressCheckout();
    return;
  }

  const configurationKey = getConfigurationKey();
  const money = getCartMoney();
  if (
    configurationKey !== state.configurationKey ||
    money.currency !== state.currentCurrency
  ) {
    await mountExpressCheckout();
  } else if (money.amount !== state.currentAmount) {
    await state.elements.update({ amount: money.amount });
    state.currentAmount = money.amount;
  }
}
