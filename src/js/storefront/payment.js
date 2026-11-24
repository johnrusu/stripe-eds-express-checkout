import {
  BADGE_STATE,
  CONSOLE,
  HTTP,
  LOG,
  PLACE_ORDER,
  SEPARATOR,
  SET_BILLING_ADDRESS,
  SET_GUEST_EMAIL,
  SET_PAAS_PAYMENT_METHOD,
  SET_PAYMENT_METHOD,
  STRIPE,
  STRIPE_PAYMENT_METHOD_CODE,
  STRIPE_PAYMENT_STATUS,
  SUPPORTED_PAYMENT_STATUSES,
  TEXT,
} from "../constants.js";
import { notifyError, notifySuccess } from "../notifications.js";
import { dom } from "./dom.js";
import { state } from "./state.js";
import { log, setBadge } from "./logging.js";
import { commerceGraphql, getCommerceHeaders, getConfig } from "./config.js";
import { persistCartId } from "./session.js";
import {
  cartNeedsWalletAddresses,
  getCartMoney,
  getShippingAddress,
  isCompleteBillingAddress,
  isCompleteCommerceAddress,
  refreshCart,
  showOrderSuccess,
} from "./cart.js";
import { setShippingAddress, setShippingMethod } from "./shipping.js";
import {
  firstCompleteWallet,
  isCompleteWalletAddress,
  toCommerceAddress,
  toWalletAddress,
} from "./wallet-address.js";
import { destroyExpressCheckout, setCheckoutBlocked } from "./express-checkout.js";
import {
  findWalletAddressMissingRegion,
  showRegionPicker,
} from "./regions.js";

function toStripeBillingDetails(event) {
  if (event.billingDetails) {
    const billingWallet = toWalletAddress(event.billingDetails);
    return {
      name: event.billingDetails.name,
      email: event.billingDetails.email || state.cart?.email,
      phone: event.billingDetails.phone,
      ...(isCompleteWalletAddress(billingWallet)
        ? { address: billingWallet.address }
        : {}),
    };
  }

  const address = state.cart?.billing_address;
  if (!address) {
    return null;
  }
  return {
    name: TEXT.fullName(address.firstname, address.lastname),
    email: state.cart?.email || undefined,
    phone: address.telephone || undefined,
    address: {
      line1: address.street?.[0] || "",
      line2: address.street?.[1] || undefined,
      city: address.city || "",
      state: address.region?.code || undefined,
      country: address.country?.code || "",
      postal_code: address.postcode || "",
    },
  };
}

function getCartCustomerName() {
  const address = state.cart?.billing_address || getShippingAddress();
  return TEXT.fullName(address?.firstname, address?.lastname);
}

async function persistBillingAddress(walletAddress, phone) {
  await commerceGraphql(SET_BILLING_ADDRESS, {
    cartId: state.cartId,
    billingAddress: {
      address: toCommerceAddress(walletAddress, phone),
    },
  });
}

async function synchronizeWalletDetails(event, extraWallets = {}) {
  const config = getConfig();
  const billingDetails = event.billingDetails;
  if (!config.customerToken && !state.cart?.email) {
    const email = billingDetails?.email;
    if (!email) {
      throw new Error(TEXT.guestEmailRequired);
    }
    await commerceGraphql(SET_GUEST_EMAIL, {
      cartId: state.cartId,
      email,
    });
  }

  const shippingWallet = firstCompleteWallet(
    extraWallets.shipping,
    toWalletAddress(event.shippingAddress),
    toWalletAddress(billingDetails)
  );
  const billingWallet = firstCompleteWallet(
    extraWallets.billing,
    toWalletAddress(billingDetails),
    shippingWallet
  );
  const phone =
    billingDetails?.phone || shippingWallet?.phone || billingWallet?.phone;

  if (isCompleteWalletAddress(shippingWallet)) {
    await setShippingAddress(shippingWallet, phone);
  }

  const selectedMethod =
    state.shippingMethodsByRateId.get(event.shippingRate?.id) ||
    state.pendingShippingMethod;
  if (
    selectedMethod &&
    (state.walletShippingAddressPersisted ||
      isCompleteCommerceAddress(getShippingAddress()))
  ) {
    await setShippingMethod(selectedMethod);
  }

  if (!isCompleteBillingAddress()) {
    if (isCompleteWalletAddress(billingWallet)) {
      await persistBillingAddress(billingWallet, phone);
    } else if (
      state.walletShippingAddressPersisted ||
      isCompleteCommerceAddress(getShippingAddress())
    ) {
      await commerceGraphql(SET_BILLING_ADDRESS, {
        cartId: state.cartId,
        billingAddress: { same_as_shipping: true },
      });
    }
  }

  return refreshCart({ synchronizeElement: false });
}

/**
 * Create a PaymentIntent through App Builder `POST {base}/payment-intent`.
 * Sends `confirmationTokenId` (Confirmation Token). Expects `client_secret`.
 * App Builder creates an unconfirmed PaymentIntent from the cart; it does not
 * confirm with the token. This client confirms via `confirmPayment`.
 *
 * @param {string} confirmationTokenId
 * @returns {Promise<{ client_secret: string, id?: string, status?: string, return_url?: string }>}
 */
async function createPaymentIntent(confirmationTokenId) {
  const config = getConfig();
  const response = await fetch(state.runtimeConfig.createPaymentIntentUrl, {
    method: HTTP.METHOD_POST,
    headers: getCommerceHeaders(),
    body: JSON.stringify({
      cartId: state.cartId,
      cartFullName: getCartCustomerName(),
      confirmationTokenId,
      storeCode: config.storeCode,
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.client_secret) {
    throw new Error(
      data?.error || data?.message || TEXT.paymentIntentCreateFailed
    );
  }
  return data;
}

async function persistPaymentMethod(clientSecret) {
  try {
    await commerceGraphql(SET_PAYMENT_METHOD, {
      cartId: state.cartId,
      input: {
        code: STRIPE_PAYMENT_METHOD_CODE,
        additional_data: [
          { key: STRIPE.CLIENT_SECRET_KEY, value: clientSecret },
        ],
      },
    });
  } catch (genericError) {
    log(LOG.paymentMethodGenericFallback, {
      message: genericError.message,
    });
    await commerceGraphql(SET_PAAS_PAYMENT_METHOD, {
      cartId: state.cartId,
      clientSecret,
    });
  }
}

function notifyPaymentFailure(
  event,
  reason = STRIPE.PAYMENT_FAILED_REASON.FAIL
) {
  if (typeof event.paymentFailed === "function") {
    event.paymentFailed({ reason });
  }
}

async function syncAmountAfterWalletUpdate(event) {
  const synchronizedMoney = getCartMoney();
  if (
    synchronizedMoney.currency !== state.currentCurrency ||
    synchronizedMoney.amount !== state.currentAmount
  ) {
    if (synchronizedMoney.currency === state.currentCurrency) {
      await state.elements.update({ amount: synchronizedMoney.amount });
      state.currentAmount = synchronizedMoney.amount;
    }
    state.walletReauthorizationRequired = true;
    notifyPaymentFailure(
      event,
      STRIPE.PAYMENT_FAILED_REASON.INVALID_SHIPPING_ADDRESS
    );
    setBadge(dom.paymentStatus, TEXT.ready, BADGE_STATE.SUCCESS);
    log(LOG.reauthorizationRequired, synchronizedMoney);
    return false;
  }
  return true;
}

async function placeOrder() {
  const data = await commerceGraphql(PLACE_ORDER, { cartId: state.cartId });
  const result = data?.placeOrder;
  if (result?.errors?.length) {
    throw new Error(
      result.errors.map((error) => error.message).join(SEPARATOR.SPACE)
    );
  }
  if (!result?.orderV2) {
    throw new Error(TEXT.orderMissing);
  }
  return result.orderV2;
}

async function runConfirmation(event) {
  state.confirmationInProgress = true;
  state.modalOpen = true;
  setCheckoutBlocked(true);
  setBadge(dom.paymentStatus, TEXT.loading, BADGE_STATE.LOADING);
  log(LOG.paymentStarted, {
    cartId: state.cartId,
    amount: state.currentAmount,
    currency: state.currentCurrency,
    expressPaymentType: event.expressPaymentType,
  });

  try {
    if (state.walletReauthorizationRequired) {
      notifyPaymentFailure(
        event,
        STRIPE.PAYMENT_FAILED_REASON.INVALID_SHIPPING_ADDRESS
      );
      log(LOG.reauthorizationRequired, {
        amount: state.currentAmount,
        currency: state.currentCurrency,
      });
      return false;
    }

    const missingRegion = await findWalletAddressMissingRegion(
      toWalletAddress(event.shippingAddress),
      toWalletAddress(event.billingDetails)
    );
    if (missingRegion) {
      notifyPaymentFailure(
        event,
        STRIPE.PAYMENT_FAILED_REASON.INVALID_SHIPPING_ADDRESS
      );
      showRegionPicker(missingRegion);
      log(LOG.regionRequired, { countryCode: missingRegion.countryCode });
      return false;
    }

    await synchronizeWalletDetails(event);
    if (!(await syncAmountAfterWalletUpdate(event))) {
      return false;
    }

    const submitResult = await state.elements.submit();
    if (submitResult?.error) {
      notifyPaymentFailure(
        event,
        STRIPE.PAYMENT_FAILED_REASON.INVALID_PAYMENT_DATA
      );
      throw submitResult.error;
    }

    const billingDetails = toStripeBillingDetails(event);
    const shippingWallet = firstCompleteWallet(
      toWalletAddress(event.shippingAddress),
      toWalletAddress(event.billingDetails)
    );
    const confirmationTokenResult = await state.stripe.createConfirmationToken({
      elements: state.elements,
      params: {
        ...(billingDetails
          ? { payment_method_data: { billing_details: billingDetails } }
          : {}),
        ...(isCompleteWalletAddress(shippingWallet)
          ? {
              shipping: {
                name: shippingWallet.name,
                phone:
                  event.billingDetails?.phone || shippingWallet.phone || null,
                address: shippingWallet.address,
              },
            }
          : {}),
      },
    });
    if (
      confirmationTokenResult.error ||
      !confirmationTokenResult.confirmationToken?.id
    ) {
      notifyPaymentFailure(
        event,
        STRIPE.PAYMENT_FAILED_REASON.INVALID_PAYMENT_DATA
      );
      throw (
        confirmationTokenResult.error ||
        new Error(TEXT.confirmationTokenMissing)
      );
    }

    const confirmationToken = confirmationTokenResult.confirmationToken;
    const confirmationTokenId = confirmationToken.id;
    log(LOG.confirmationTokenCreated, {
      confirmationTokenId,
      hasShipping: isCompleteWalletAddress(
        toWalletAddress(confirmationToken.shipping)
      ),
    });

    if (cartNeedsWalletAddresses()) {
      await synchronizeWalletDetails(event, {
        shipping: toWalletAddress(confirmationToken.shipping),
        billing: toWalletAddress(
          confirmationToken.payment_method_preview?.billing_details
        ),
      });
      if (!(await syncAmountAfterWalletUpdate(event))) {
        return false;
      }
    }
    if (cartNeedsWalletAddresses()) {
      log(LOG.shippingAddressError, {
        message: TEXT.walletAddressIncomplete,
        hasEventShipping: Boolean(event.shippingAddress),
        hasTokenShipping: isCompleteWalletAddress(
          toWalletAddress(confirmationToken.shipping)
        ),
      });
      throw new Error(TEXT.walletAddressIncomplete);
    }

    const paymentIntentData = await createPaymentIntent(confirmationTokenId);
    log(LOG.intentCreated, {
      paymentIntentId: paymentIntentData.id,
      status: paymentIntentData.status,
      hasClientSecret: Boolean(paymentIntentData.client_secret),
    });
    await persistPaymentMethod(paymentIntentData.client_secret);

    const confirmationResult = await state.stripe.confirmPayment({
      clientSecret: paymentIntentData.client_secret,
      confirmParams: {
        confirmation_token: confirmationTokenId,
        ...(paymentIntentData.return_url
          ? { return_url: paymentIntentData.return_url }
          : {}),
      },
      redirect: STRIPE.REDIRECT,
    });
    if (confirmationResult.error) {
      notifyPaymentFailure(event);
      throw confirmationResult.error;
    }

    if (
      confirmationResult.paymentIntent?.status &&
      !SUPPORTED_PAYMENT_STATUSES.has(confirmationResult.paymentIntent.status)
    ) {
      notifyPaymentFailure(event);
      throw new Error(
        TEXT.unexpectedPaymentStatus(confirmationResult.paymentIntent.status)
      );
    }

    const paymentIntent = confirmationResult.paymentIntent;
    log(LOG.paymentSucceeded, {
      paymentIntentId: paymentIntent?.id,
      status: paymentIntent?.status,
      amount: paymentIntent?.amount,
      currency: paymentIntent?.currency,
      captureMethod: paymentIntent?.capture_method,
      confirmationTokenId,
    });

    const order = await placeOrder();
    setBadge(dom.paymentStatus, TEXT.orderPlaced, BADGE_STATE.SUCCESS);
    showOrderSuccess(order, paymentIntent?.status);
    log(LOG.orderPlaced, {
      orderNumber: order?.number,
      orderId: order?.id,
      paymentIntentId: paymentIntent?.id,
      paymentStatus: paymentIntent?.status,
    });
    notifySuccess(
      paymentIntent?.status === STRIPE_PAYMENT_STATUS.REQUIRES_CAPTURE
        ? TEXT.paymentAuthorized
        : TEXT.paymentSuccessful
    );
    persistCartId(null);
    state.cart = null;
    destroyExpressCheckout();
    return true;
  } catch (error) {
    console.warn(CONSOLE.confirmationFailed, error);
    notifyPaymentFailure(event);
    setBadge(dom.paymentStatus, TEXT.paymentFailed, BADGE_STATE.ERROR);
    log(LOG.paymentFailed, {
      message: error?.message || TEXT.paymentFailed,
      name: error?.name,
      type: error?.type,
      code: error?.code,
      declineCode: error?.decline_code,
      paymentIntentId: error?.payment_intent?.id,
      graphqlErrors: error?.graphqlErrors,
      commerceRequestId: error?.commerceRequestId,
    });
    notifyError(error?.message || TEXT.paymentFailed);
    return false;
  } finally {
    state.confirmationInProgress = false;
    state.modalOpen = false;
    setCheckoutBlocked(false);
  }
}

export function handleConfirm(event) {
  if (!state.activeConfirmation) {
    state.activeConfirmation = runConfirmation(event).finally(() => {
      state.activeConfirmation = null;
    });
  }
  return state.activeConfirmation;
}
