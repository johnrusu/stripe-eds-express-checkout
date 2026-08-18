/* global Stripe */

import {
  ADD_PRODUCT,
  ARIA,
  BADGE_STATE,
  CART_STORAGE_KEY,
  CLIPBOARD,
  COMMERCE_URL_PATTERN,
  CONFIG_STORAGE_KEY,
  CONSOLE,
  CREATE_GUEST_CART,
  CSS_CLASS,
  DATASET,
  DEFAULT_PRODUCT_QUANTITY,
  DEFAULT_STORE_CODE,
  DOM_EVENT,
  EMPTY_DISPLAY,
  ENVIRONMENTS,
  ESTIMATE_SHIPPING_METHODS,
  GET_CUSTOMER_CART,
  GET_GUEST_CART,
  HTML_ELEMENT,
  HTTP,
  JSON_NULL,
  LEGACY_CONFIGURATION_STORAGE_KEY,
  LOG,
  NUMBER_FORMAT,
  PLACE_ORDER,
  RUNTIME_PATH,
  SELECTOR,
  SEPARATOR,
  SET_BILLING_ADDRESS,
  SET_GUEST_EMAIL,
  SET_PAAS_PAYMENT_METHOD,
  SET_PAYMENT_METHOD,
  SET_SHIPPING_ADDRESS,
  SET_SHIPPING_METHOD,
  STRIPE,
  STRIPE_PAYMENT_METHOD_CODE,
  STRIPE_PAYMENT_STATUS,
  SUPPORTED_PAYMENT_STATUSES,
  TEXT,
  WALLET_NAME_SPLIT_PATTERN,
  WINDOW_SCROLL_TOP,
} from "./constants.js";
import { notifyError, notifySuccess, notifyWarning } from "./notifications.js";

const dom = {
  addProductButton: document.querySelector(SELECTOR.addProductButton),
  blocker: document.querySelector(SELECTOR.blocker),
  cartForm: document.querySelector(SELECTOR.cartForm),
  cartId: document.querySelector(SELECTOR.cartId),
  cartStatus: document.querySelector(SELECTOR.cartStatus),
  clearLogButton: document.querySelector(SELECTOR.clearLogButton),
  copyLogButton: document.querySelector(SELECTOR.copyLogButton),
  clearSessionButton: document.querySelector(SELECTOR.clearSessionButton),
  commerceUrl: document.querySelector(SELECTOR.commerceUrl),
  configurationForm: document.querySelector(SELECTOR.configurationForm),
  connectionStatus: document.querySelector(SELECTOR.connectionStatus),
  createCartButton: document.querySelector(SELECTOR.createCartButton),
  customerToken: document.querySelector(SELECTOR.customerToken),
  environmentPreset: document.querySelector(SELECTOR.environmentPreset),
  expressCheckoutSection: document.querySelector(
    SELECTOR.expressCheckoutSection
  ),
  log: document.querySelector(SELECTOR.log),
  paymentContent: document.querySelector(SELECTOR.paymentContent),
  paymentStatus: document.querySelector(SELECTOR.paymentStatus),
  orderSuccess: document.querySelector(SELECTOR.orderSuccess),
  orderSuccessMessage: document.querySelector(SELECTOR.orderSuccessMessage),
  orderSuccessTitle: document.querySelector(SELECTOR.orderSuccessTitle),
  startOverButton: document.querySelector(SELECTOR.startOverButton),
  productQuantity: document.querySelector(SELECTOR.productQuantity),
  productSku: document.querySelector(SELECTOR.productSku),
  runtimeBaseUrl: document.querySelector(SELECTOR.runtimeBaseUrl),
  storeCode: document.querySelector(SELECTOR.storeCode),
  summaryCapture: document.querySelector(SELECTOR.summaryCapture),
  summaryCustomer: document.querySelector(SELECTOR.summaryCustomer),
  summaryShippingAddress: document.querySelector(
    SELECTOR.summaryShippingAddress
  ),
  summaryShippingMethod: document.querySelector(SELECTOR.summaryShippingMethod),
  summaryStripe: document.querySelector(SELECTOR.summaryStripe),
  summaryTotal: document.querySelector(SELECTOR.summaryTotal),
  wallet: document.querySelector(SELECTOR.wallet),
  purgeLocalStorageButton: document.querySelector(
    SELECTOR.purgeLocalStorageButton
  ),
};

const state = {
  activeConfirmation: null,
  cart: null,
  cartId: null,
  configurationKey: null,
  confirmationInProgress: false,
  connected: false,
  connectedCommerceUrl: null,
  currentAmount: null,
  currentCurrency: null,
  currentShippingRates: [],
  elementLoadFailed: false,
  elements: null,
  expressCheckoutElement: null,
  initParams: null,
  modalOpen: false,
  pendingShippingMethod: null,
  runtimeConfig: null,
  shippingMethodsByRateId: new Map(),
  stripe: null,
  walletShippingAddressPersisted: false,
};

function setBadge(element, message, status = "") {
  element.textContent = message;
  if (status) {
    element.dataset[DATASET.STATE] = status;
  } else {
    delete element.dataset[DATASET.STATE];
  }
}

function log(eventName, payload) {
  const timestamp = new Date().toISOString();
  let serialized = "";
  if (payload !== undefined) {
    try {
      serialized = `\n${JSON.stringify(payload, null, 2)}`;
    } catch {
      serialized = `\n${String(payload)}`;
    }
  }
  dom.log.textContent = `[${timestamp}] ${eventName}${serialized}\n\n${dom.log.textContent}`;
  syncLogActionsAvailability();
  syncStorageActionAvailability();
}

function hasLogContent() {
  return Boolean(dom.log.textContent?.trim());
}

function syncLogActionsAvailability() {
  const disabled = !hasLogContent();
  dom.copyLogButton.disabled = disabled;
  dom.clearLogButton.disabled = disabled;
}

function normalizeBaseUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "");
}

function getConfig() {
  const commerceUrl = dom.commerceUrl.value.trim();
  if (!COMMERCE_URL_PATTERN.test(commerceUrl)) {
    throw new Error(TEXT.invalidConfiguration);
  }

  return {
    commerceUrl,
    customerToken: dom.customerToken.value.trim(),
    runtimeBaseUrl: normalizeBaseUrl(dom.runtimeBaseUrl.value),
    storeCode: dom.storeCode.value.trim() || DEFAULT_STORE_CODE,
    productSku: dom.productSku.value.trim(),
  };
}

function savePublicConfiguration(config) {
  window.localStorage.setItem(
    CONFIG_STORAGE_KEY,
    JSON.stringify({
      productSku: config.productSku || dom.productSku.value.trim(),
      commerceUrl: config.commerceUrl,
      runtimeBaseUrl: config.runtimeBaseUrl,
      storeCode: config.storeCode,
      environmentPreset: dom.environmentPreset.value || "",
    })
  );
  syncStorageActionAvailability();
}

const persistPublicConfiguration = () => {
  try {
    savePublicConfiguration(getConfig());
  } catch {
    return;
  }
};

function restoreConfiguration() {
  window.localStorage.removeItem(LEGACY_CONFIGURATION_STORAGE_KEY);

  try {
    const config = JSON.parse(
      window.localStorage.getItem(CONFIG_STORAGE_KEY) || JSON_NULL
    );
    if (config) {
      dom.productSku.value = config.productSku || "";
      dom.commerceUrl.value = config.commerceUrl || "";
      dom.runtimeBaseUrl.value = config.runtimeBaseUrl || "";
      dom.storeCode.value = config.storeCode || DEFAULT_STORE_CODE;
      if (config.environmentPreset && ENVIRONMENTS[config.environmentPreset]) {
        dom.environmentPreset.value = config.environmentPreset;
      } else {
        syncEnvironmentPresetSelection();
      }
    }
  } catch (error) {
    console.warn(CONSOLE.restoreConfigurationFailed, error);
  }

  const cartId = window.sessionStorage.getItem(CART_STORAGE_KEY);
  if (cartId) {
    dom.cartId.value = cartId;
    state.cartId = cartId;
  }
}

function applyEnvironmentPreset(presetKey, { notify = true } = {}) {
  const preset = ENVIRONMENTS[presetKey];
  if (!preset) {
    return;
  }

  const previousCommerceUrl = dom.commerceUrl.value.trim();
  dom.commerceUrl.value = preset.commerceGraphqlUrl;
  dom.runtimeBaseUrl.value = preset.appBuilderStripeActionBaseUrl;
  dom.productSku.value = preset.productSku;
  dom.environmentPreset.value = presetKey;

  if (
    state.connected &&
    previousCommerceUrl &&
    previousCommerceUrl !== preset.commerceGraphqlUrl
  ) {
    handleCommerceUrlChange();
  }

  persistPublicConfiguration();
  syncStorageActionAvailability();
  syncCartActionAvailability();
  log(LOG.environmentPreset, {
    environment: presetKey,
    commerceGraphqlUrl: preset.commerceGraphqlUrl,
    productSku: preset.productSku,
  });

  if (notify) {
    notifySuccess(TEXT.loadedPreset(preset.label));
  }
}

function syncEnvironmentPresetSelection() {
  const commerceUrl = dom.commerceUrl.value.trim();
  const runtimeBaseUrl = normalizeBaseUrl(dom.runtimeBaseUrl.value);
  const match = Object.entries(ENVIRONMENTS).find(
    ([, preset]) =>
      preset.commerceGraphqlUrl === commerceUrl &&
      normalizeBaseUrl(preset.appBuilderStripeActionBaseUrl) === runtimeBaseUrl
  );
  dom.environmentPreset.value = match?.[0] || "";
}

function getCommerceHeaders() {
  const config = getConfig();
  return {
    [HTTP.CONTENT_TYPE]: HTTP.CONTENT_TYPE_JSON,
    [HTTP.HEADER_STORE]: config.storeCode,
    ...(config.customerToken
      ? {
          [HTTP.HEADER_AUTHORIZATION]: `${HTTP.BEARER_PREFIX}${config.customerToken}`,
        }
      : {}),
  };
}

async function commerceGraphql(query, variables = {}) {
  const config = getConfig();
  const response = await fetch(config.commerceUrl, {
    method: HTTP.METHOD_POST,
    credentials: HTTP.CREDENTIALS_INCLUDE,
    headers: getCommerceHeaders(),
    body: JSON.stringify({ query, variables }),
  });
  const result = await response.json().catch(() => null);

  if (!response.ok || result?.errors?.length) {
    const message =
      result?.errors?.map((error) => error.message).join(SEPARATOR.SPACE) ||
      `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return result?.data;
}

function persistCartId(cartId) {
  state.cartId = cartId || null;
  dom.cartId.value = cartId || "";
  if (cartId) {
    window.sessionStorage.setItem(CART_STORAGE_KEY, cartId);
  } else {
    window.sessionStorage.removeItem(CART_STORAGE_KEY);
  }
  syncCartActionAvailability();
}

function hasCartId() {
  return Boolean(dom.cartId.value.trim() || state.cartId);
}

function hasProductSku() {
  return Boolean(dom.productSku.value.trim());
}

function syncCartActionAvailability() {
  dom.addProductButton.disabled = !hasCartId() || !hasProductSku();
  syncStorageActionAvailability();
}

function syncCreateCartAvailability() {
  dom.createCartButton.disabled = !state.connected;
  syncStorageActionAvailability();
}

function hasLocalSession() {
  return Boolean(
    dom.productSku.value.trim() ||
    window.localStorage.getItem(CONFIG_STORAGE_KEY) ||
    window.sessionStorage.getItem(CART_STORAGE_KEY) ||
    state.connected ||
    state.cart ||
    hasCartId() ||
    dom.commerceUrl.value.trim() ||
    dom.runtimeBaseUrl.value.trim() ||
    dom.customerToken.value.trim() ||
    (dom.storeCode.value.trim() &&
      dom.storeCode.value.trim() !== DEFAULT_STORE_CODE) ||
    hasLogContent()
  );
}

function hasLocalStorageData() {
  return window.localStorage.length > 0;
}

function syncStorageActionAvailability() {
  if (dom.clearSessionButton) {
    dom.clearSessionButton.disabled = !hasLocalSession();
  }
  if (dom.purgeLocalStorageButton) {
    dom.purgeLocalStorageButton.disabled = !hasLocalStorageData();
  }
}

function setConnected(connected, commerceUrl = null) {
  state.connected = Boolean(connected);
  state.connectedCommerceUrl = state.connected
    ? String(commerceUrl || "").trim() || null
    : null;
  syncCreateCartAvailability();
}

function clearCartSession() {
  window.sessionStorage.removeItem(CART_STORAGE_KEY);
  persistCartId(null);
  state.cart = null;
  destroyExpressCheckout();
  hideExpressCheckout();
  hideOrderSuccess();
  setBadge(dom.cartStatus, TEXT.noCart);
  renderCartSummary();
}

function handleCommerceUrlChange() {
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

function getStripePaymentMethod(cart = state.cart) {
  return [
    cart?.selected_payment_method,
    ...(cart?.available_payment_methods || []),
  ].find((method) => method?.code === STRIPE_PAYMENT_METHOD_CODE);
}

function discoverRuntimeConfig(cart = state.cart) {
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

async function createOrLoadCart() {
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

async function fetchCart() {
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

function getCartMoney(cart = state.cart) {
  const money = cart?.prices?.grand_total;
  if (!money || !Number.isFinite(Number(money.value)) || !money.currency) {
    throw new Error(TEXT.cartTotalUnavailable);
  }
  return {
    amount: Math.round(Number(money.value) * 100),
    currency: String(money.currency).toLowerCase(),
  };
}

function formatMoney(money) {
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

function getShippingAddress(cart = state.cart) {
  return cart?.shipping_addresses?.[0] || null;
}

function getSelectedShippingMethod(cart = state.cart) {
  return getShippingAddress(cart)?.selected_shipping_method || null;
}

function isCompleteCommerceAddress(address) {
  return Boolean(
    address?.firstname &&
    address?.lastname &&
    address?.street?.[0] &&
    address?.city &&
    address?.country?.code &&
    address?.postcode
  );
}

function isCompleteBillingAddress(cart = state.cart) {
  return isCompleteCommerceAddress(cart?.billing_address);
}

function shouldCollectShipping(cart = state.cart) {
  if (cart?.is_virtual) {
    return false;
  }
  return !(
    isCompleteCommerceAddress(getShippingAddress(cart)) &&
    getSelectedShippingMethod(cart)
  );
}

function renderCartSummary() {
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

function hideOrderSuccess() {
  dom.orderSuccess.hidden = true;
  dom.orderSuccessMessage.textContent = "";
  dom.paymentContent.hidden = false;
}

function showOrderSuccess(order, paymentIntentStatus) {
  dom.orderSuccessTitle.textContent =
    paymentIntentStatus === STRIPE_PAYMENT_STATUS.REQUIRES_CAPTURE
      ? TEXT.paymentAuthorized
      : TEXT.paymentSuccessful;
  dom.orderSuccessMessage.textContent = TEXT.orderConfirmed(order?.number);
  dom.paymentContent.hidden = true;
  dom.orderSuccess.hidden = false;
}

async function refreshCart({ synchronizeElement = true } = {}) {
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

function getShippingMethods(cart = state.cart) {
  return getShippingAddress(cart)?.available_shipping_methods || [];
}

function getShippingMethodRateId(method) {
  return `${encodeURIComponent(method.carrier_code)}${SEPARATOR.COLON}${encodeURIComponent(method.method_code)}`;
}

function toStripeShippingRate(method) {
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
    amount: Math.round(Number(amount.value) * 100),
  };
}

function setAvailableShippingMethods(methods = []) {
  state.shippingMethodsByRateId = new Map();
  state.currentShippingRates = methods
    .map(toStripeShippingRate)
    .filter(Boolean);
  return state.currentShippingRates;
}

function getExpressCheckoutOptions() {
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

function getConfigurationKey() {
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
async function fetchInitParams() {
  const response = await fetch(state.runtimeConfig.getInitParamsUrl);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.publishableKey) {
    throw new Error(TEXT.initializationFailed);
  }
  return data;
}

function destroyExpressCheckout() {
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
  state.walletShippingAddressPersisted = false;
}

function hideExpressCheckout(message = null) {
  dom.expressCheckoutSection.classList.add(CSS_CLASS.HIDDEN);
  dom.wallet.classList.remove(CSS_CLASS.OPACITY_25);
  if (message) {
    setBadge(dom.paymentStatus, message, BADGE_STATE.ERROR);
  }
}

function showExpressCheckout() {
  if (state.elementLoadFailed) {
    return;
  }
  dom.expressCheckoutSection.classList.remove(CSS_CLASS.HIDDEN);
  dom.wallet.classList.remove(CSS_CLASS.OPACITY_25);
  setBadge(dom.paymentStatus, TEXT.ready, BADGE_STATE.SUCCESS);
}

function setCheckoutBlocked(blocked) {
  dom.blocker.hidden = !blocked;
  document.body.setAttribute(ARIA.BUSY, String(blocked));
}

function handleModalDismissed() {
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

function splitName(name) {
  const parts = String(name || "")
    .trim()
    .split(WALLET_NAME_SPLIT_PATTERN)
    .filter(Boolean);
  if (parts.length < 2) {
    throw new Error(TEXT.walletNameRequired);
  }
  return { firstname: parts.shift(), lastname: parts.join(SEPARATOR.SPACE) };
}

const readWalletValue = (...values) => {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) {
      return normalized;
    }
  }
  return "";
};

/**
 * Normalize ECE / Amazon Pay address payloads onto Stripe's `{ name, address }` shape.
 * Confirm events nest `address`; some wallets flatten fields or use Amazon keys.
 * Amazon Pay DE billing often leaves `line1` empty and puts the street in `line2`.
 *
 * @param {object | null | undefined} source
 * @returns {{ name: string, phone?: string, address: object } | null}
 */
function toWalletAddress(source) {
  if (!source) {
    return null;
  }
  const nested =
    source.address && typeof source.address === "object"
      ? source.address
      : null;
  const streetLine1 = readWalletValue(
    nested?.line1,
    nested?.addressLine1,
    source.line1,
    source.addressLine1
  );
  const streetLine2 = readWalletValue(
    nested?.line2,
    nested?.addressLine2,
    source.line2,
    source.addressLine2
  );
  const address = {
    line1: streetLine1 || streetLine2,
    line2: streetLine1 ? streetLine2 || undefined : undefined,
    city: readWalletValue(nested?.city, source.city),
    state:
      readWalletValue(
        nested?.state,
        nested?.stateOrRegion,
        source.state,
        source.stateOrRegion
      ) || undefined,
    country: readWalletValue(
      nested?.country,
      nested?.countryCode,
      source.country,
      source.countryCode
    ),
    postal_code: readWalletValue(
      nested?.postal_code,
      nested?.postalCode,
      source.postal_code,
      source.postalCode
    ),
  };
  const name = readWalletValue(source.name, nested?.name);
  const phone =
    readWalletValue(
      source.phone,
      source.phoneNumber,
      nested?.phone,
      nested?.phoneNumber
    ) || undefined;
  if (
    !name &&
    !address.line1 &&
    !address.city &&
    !address.country &&
    !address.postal_code
  ) {
    return null;
  }
  return { name, phone, address };
}

function isCompleteWalletAddress(walletAddress) {
  const address = walletAddress?.address;
  return Boolean(
    walletAddress?.name &&
    address?.line1 &&
    address?.city &&
    address?.country &&
    address?.postal_code
  );
}

const firstCompleteWallet = (...wallets) =>
  wallets.find((wallet) => isCompleteWalletAddress(wallet)) || null;

function cartNeedsWalletAddresses() {
  return (
    (shouldCollectShipping() &&
      !isCompleteCommerceAddress(getShippingAddress())) ||
    !isCompleteBillingAddress()
  );
}

function toCommerceAddress(walletAddress, phone) {
  const normalized = toWalletAddress(walletAddress);
  if (!isCompleteWalletAddress(normalized)) {
    throw new Error(TEXT.walletAddressIncomplete);
  }
  const name = splitName(normalized.name);
  const address = normalized.address;
  const telephone = phone || normalized.phone;
  return {
    ...name,
    street: [address.line1, address.line2].filter(Boolean),
    city: address.city,
    country_code: address.country,
    postcode: address.postal_code,
    ...(address.state ? { region: address.state } : {}),
    ...(telephone ? { telephone } : {}),
  };
}

async function setShippingAddress(walletAddress, phone) {
  await commerceGraphql(SET_SHIPPING_ADDRESS, {
    cartId: state.cartId,
    shippingAddress: {
      address: toCommerceAddress(walletAddress, phone),
    },
  });
  state.walletShippingAddressPersisted = true;
}

async function estimateShippingMethods(address) {
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

async function setShippingMethod(method) {
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

async function handleShippingAddressChange(event) {
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
    event.resolve({ shippingRates });
    log(LOG.shippingAddressChange, {
      persisted: state.walletShippingAddressPersisted,
      shippingRates,
    });
  } catch (error) {
    console.warn(CONSOLE.processShippingAddressFailed, error);
    event.reject();
    log(LOG.shippingAddressError, { message: error.message });
  }
}

async function handleShippingRateChange(event) {
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
    }

    event.resolve({ shippingRates: state.currentShippingRates });
    log(LOG.shippingRateChange, {
      carrierCode: method.carrier_code,
      methodCode: method.method_code,
    });
  } catch (error) {
    console.warn(CONSOLE.persistShippingMethodFailed, error);
    event.reject();
    log(LOG.shippingRateError, { message: error.message });
  }
}

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
    });
    notifyError(error?.message || TEXT.paymentFailed);
    return false;
  } finally {
    state.confirmationInProgress = false;
    state.modalOpen = false;
    setCheckoutBlocked(false);
  }
}

function handleConfirm(event) {
  if (!state.activeConfirmation) {
    state.activeConfirmation = runConfirmation(event).finally(() => {
      state.activeConfirmation = null;
    });
  }
  return state.activeConfirmation;
}

function registerExpressCheckoutHandlers() {
  state.expressCheckoutElement.on(STRIPE.EVENT.CLICK, (event) => {
    state.modalOpen = true;
    setCheckoutBlocked(true);
    log(LOG.walletClicked, {
      cartId: state.cartId,
      amount: state.currentAmount,
      currency: state.currentCurrency,
      expressPaymentType: event.expressPaymentType,
    });
    event.resolve({ shippingRates: state.currentShippingRates });
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

async function mountExpressCheckout() {
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

async function synchronizeExpressCheckout() {
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

async function handleConnect(event) {
  event.preventDefault();
  setBadge(dom.connectionStatus, TEXT.connecting, BADGE_STATE.LOADING);
  try {
    const config = getConfig();
    if (
      state.connectedCommerceUrl &&
      config.commerceUrl !== state.connectedCommerceUrl
    ) {
      const hadCart = Boolean(state.cartId || state.cart);
      clearCartSession();
      if (hadCart) {
        notifyWarning(TEXT.commerceUrlChangedBeforeConnect);
      }
    }
    savePublicConfiguration(config);
    setConnected(true, config.commerceUrl);
    setBadge(dom.connectionStatus, TEXT.connected, BADGE_STATE.SUCCESS);
    if (dom.cartId.value.trim() || config.customerToken) {
      await refreshCart();
    }
    log(LOG.configurationConnected, {
      commerceUrl: config.commerceUrl,
      authenticated: Boolean(config.customerToken),
      storeCode: config.storeCode,
    });
    notifySuccess(TEXT.storefrontConnected);
  } catch (error) {
    setConnected(false);
    setBadge(dom.connectionStatus, error.message, BADGE_STATE.ERROR);
    log(LOG.configurationError, { message: error.message });
    notifyError(error.message || TEXT.connectFailed);
  }
}

async function handleCreateCart() {
  if (!state.connected) {
    notifyError(TEXT.notConnected);
    return;
  }

  dom.createCartButton.disabled = true;
  try {
    await createOrLoadCart();
    log(LOG.cartReady, {
      cartId: state.cartId,
      total: state.cart?.prices?.grand_total,
    });
    notifySuccess(TEXT.cartReady(state.cartId));
  } catch (error) {
    setBadge(dom.cartStatus, error.message, BADGE_STATE.ERROR);
    log(LOG.cartCreateError, { message: error.message });
    notifyError(error.message || TEXT.createCartFailed);
  } finally {
    syncCreateCartAvailability();
  }
}

async function handleAddProduct(event) {
  event.preventDefault();
  if (!hasCartId()) {
    notifyError(TEXT.cartMissing);
    return;
  }
  if (!hasProductSku()) {
    notifyError(TEXT.productSkuRequired);
    return;
  }

  dom.addProductButton.disabled = true;
  try {
    const cartId = dom.cartId.value.trim() || state.cartId;
    persistCartId(cartId);
    const sku = dom.productSku.value.trim();
    const quantity = Number(dom.productQuantity.value);
    if (!sku || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(TEXT.productSkuAndQuantityRequired);
    }
    const data = await commerceGraphql(ADD_PRODUCT, {
      cartId: state.cartId,
      sku,
      quantity,
    });
    const userErrors = data?.addProductsToCart?.user_errors || [];
    if (userErrors.length) {
      throw new Error(
        userErrors.map((error) => error.message).join(SEPARATOR.SPACE)
      );
    }
    await refreshCart();
    setBadge(dom.cartStatus, TEXT.addedProduct, BADGE_STATE.SUCCESS);
    log(LOG.cartProductAdded, {
      cartId: state.cartId,
      sku,
      quantity,
      total: state.cart?.prices?.grand_total,
    });
    persistPublicConfiguration();
    notifySuccess(TEXT.addedSku(quantity, sku));
  } catch (error) {
    setBadge(dom.cartStatus, error.message, BADGE_STATE.ERROR);
    log(LOG.cartAddProductError, { message: error.message });
    notifyError(error.message || TEXT.addProductFailed);
  } finally {
    syncCartActionAvailability();
  }
}

/**
 * Reset connected state, cart session, form fields, and the checkout log.
 *
 * @param {{ notifyMessage?: string, force?: boolean }} [options]
 */
const clearLocalSession = ({
  notifyMessage = TEXT.localSessionCleared,
  force = false,
} = {}) => {
  if (!force && !hasLocalSession() && dom.orderSuccess.hidden) {
    return;
  }

  window.localStorage.removeItem(CONFIG_STORAGE_KEY);
  clearCartSession();
  setConnected(false);
  dom.commerceUrl.value = "";
  dom.runtimeBaseUrl.value = "";
  dom.customerToken.value = "";
  dom.storeCode.value = DEFAULT_STORE_CODE;
  dom.productSku.value = "";
  dom.productQuantity.value = DEFAULT_PRODUCT_QUANTITY;
  dom.environmentPreset.value = "";
  dom.log.textContent = "";
  syncLogActionsAvailability();
  syncStorageActionAvailability();
  setBadge(dom.connectionStatus, TEXT.notConnected);
  notifySuccess(notifyMessage);
};

/**
 * Clear every localStorage key, then reset the in-memory session so the UI
 * cannot keep a connection whose persisted config no longer exists.
 */
const handlePurgeLocalStorage = () => {
  if (!hasLocalStorageData()) {
    return;
  }

  const keys = Object.keys(window.localStorage);
  window.localStorage.clear();
  clearLocalSession({
    notifyMessage: TEXT.purgedStorage(keys.length),
    force: true,
  });
};

dom.configurationForm.addEventListener(DOM_EVENT.SUBMIT, handleConnect);
dom.environmentPreset.addEventListener(DOM_EVENT.CHANGE, (event) => {
  const presetKey = event.target.value;
  if (!presetKey) {
    return;
  }
  applyEnvironmentPreset(presetKey);
});
dom.commerceUrl.addEventListener(DOM_EVENT.CHANGE, () => {
  handleCommerceUrlChange();
  syncEnvironmentPresetSelection();
});
dom.runtimeBaseUrl.addEventListener(
  DOM_EVENT.CHANGE,
  syncEnvironmentPresetSelection
);
dom.createCartButton.addEventListener(DOM_EVENT.CLICK, handleCreateCart);
dom.cartForm.addEventListener(DOM_EVENT.SUBMIT, handleAddProduct);
dom.cartId.addEventListener(DOM_EVENT.INPUT, syncCartActionAvailability);
dom.productSku.addEventListener(DOM_EVENT.INPUT, syncCartActionAvailability);
dom.productSku.addEventListener(DOM_EVENT.CHANGE, persistPublicConfiguration);
dom.clearSessionButton.addEventListener(DOM_EVENT.CLICK, clearLocalSession);
dom.purgeLocalStorageButton?.addEventListener(
  DOM_EVENT.CLICK,
  handlePurgeLocalStorage
);
dom.startOverButton.addEventListener(DOM_EVENT.CLICK, () => {
  clearLocalSession({ notifyMessage: TEXT.storefrontReset });
  window.scrollTo(WINDOW_SCROLL_TOP);
});
dom.clearLogButton.addEventListener(DOM_EVENT.CLICK, () => {
  dom.log.textContent = "";
  syncLogActionsAvailability();
  syncStorageActionAvailability();
  notifySuccess(TEXT.checkoutLogCleared);
});

[dom.commerceUrl, dom.runtimeBaseUrl, dom.customerToken, dom.storeCode].forEach(
  (input) => {
    input.addEventListener(DOM_EVENT.INPUT, syncStorageActionAvailability);
    input.addEventListener(DOM_EVENT.CHANGE, syncStorageActionAvailability);
  }
);

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement(HTML_ELEMENT.TEXTAREA);
  textarea.value = text;
  textarea.setAttribute(CLIPBOARD.READONLY, "");
  textarea.style.position = CLIPBOARD.POSITION;
  textarea.style.left = CLIPBOARD.LEFT;
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (!document.execCommand(CLIPBOARD.EXEC_COMMAND)) {
      throw new Error(TEXT.copyCommandFailed);
    }
  } finally {
    textarea.remove();
  }
}

dom.copyLogButton.addEventListener(DOM_EVENT.CLICK, async () => {
  const text = dom.log.textContent || "";
  if (!text.trim()) {
    notifyError(TEXT.checkoutLogEmpty);
    return;
  }

  try {
    await copyTextToClipboard(text);
    notifySuccess(TEXT.checkoutLogCopied);
  } catch {
    notifyError(TEXT.copyLogFailed);
  }
});

restoreConfiguration();
renderCartSummary();
syncCreateCartAvailability();
syncCartActionAvailability();
syncLogActionsAvailability();
syncStorageActionAvailability();
