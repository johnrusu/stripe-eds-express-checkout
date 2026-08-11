/* global Stripe */

import { notifyError, notifySuccess, notifyWarning } from "./notifications.js";
import { ENVIRONMENTS } from "./environments.js";

const STRIPE_PAYMENT_METHOD_CODE = "oope_stripe";
const CONFIG_STORAGE_KEY = "STRIPE_ECE_STOREFRONT_CONFIG";
const CART_STORAGE_KEY = "STRIPE_ECE_STOREFRONT_CART_ID";
const SUPPORTED_PAYMENT_STATUSES = new Set([
  "processing",
  "requires_capture",
  "succeeded",
]);

const TEXT = {
  addedProduct: "Product added",
  available: "Available",
  cartLoaded: "Cart loaded",
  cartMissing: "Create or load a cart first.",
  connected: "Connected",
  connecting: "Connecting…",
  customerRegistered: "Registered customer",
  guest: "Guest",
  initializationFailed: "Express Checkout initialization failed.",
  invalidConfiguration: "Enter a valid Commerce GraphQL URL.",
  loading: "Loading…",
  missing: "Missing",
  noCart: "No cart",
  notConnected: "Not connected",
  notAvailable: "Unavailable",
  orderPlaced: "Order placed",
  paymentAuthorized: "Payment authorized",
  paymentSuccessful: "Payment successful",
  orderConfirmed: (number) =>
    number
      ? `Order ${number} has been confirmed.`
      : "Your order has been confirmed.",
  paymentFailed: "Payment failed",
  ready: "Ready",
  refreshFailed: "Unable to refresh the cart.",
  runtimeMissing: "Stripe runtime configuration is unavailable on this cart.",
  stripeMissing: "Stripe OOPE is not available on this cart.",
  walletUnavailable: "No supported wallet is available in this browser.",
};

const CART_FIELDS = `
  id
  email
  is_virtual
  prices {
    grand_total { value currency }
  }
  billing_address {
    firstname
    lastname
    street
    city
    region { code }
    postcode
    country { code }
    telephone
  }
  shipping_addresses {
    firstname
    lastname
    street
    city
    region { code }
    postcode
    country { code }
    telephone
    available_shipping_methods {
      carrier_code
      carrier_title
      method_code
      method_title
      amount { value currency }
      price_excl_tax { value currency }
      price_incl_tax { value currency }
    }
    selected_shipping_method {
      carrier_code
      carrier_title
      method_code
      method_title
      amount { value currency }
      price_excl_tax { value currency }
      price_incl_tax { value currency }
    }
  }
  available_payment_methods {
    code
    title
    oope_payment_method_config {
      backend_integration_url
    }
  }
  selected_payment_method {
    code
    title
    oope_payment_method_config {
      backend_integration_url
    }
  }
`;

const CREATE_GUEST_CART = `
  mutation CreateGuestCart {
    createGuestCart {
      cart { id }
    }
  }
`;

const GET_GUEST_CART = `
  query GetGuestCart($cartId: String!) {
    cart(cart_id: $cartId) {
      ${CART_FIELDS}
    }
  }
`;

const GET_CUSTOMER_CART = `
  query GetCustomerCart {
    cart: customerCart {
      ${CART_FIELDS}
    }
  }
`;

const ADD_PRODUCT = `
  mutation AddProduct($cartId: String!, $sku: String!, $quantity: Float!) {
    addProductsToCart(
      cartId: $cartId
      cartItems: [{ sku: $sku, quantity: $quantity }]
    ) {
      cart { id }
      user_errors { code message }
    }
  }
`;

const SET_GUEST_EMAIL = `
  mutation SetGuestEmail($cartId: String!, $email: String!) {
    setGuestEmailOnCart(input: { cart_id: $cartId, email: $email }) {
      cart { id email }
    }
  }
`;

const SET_SHIPPING_ADDRESS = `
  mutation SetShippingAddress(
    $cartId: String!
    $shippingAddress: ShippingAddressInput!
  ) {
    setShippingAddressesOnCart(
      input: { cart_id: $cartId, shipping_addresses: [$shippingAddress] }
    ) {
      cart { id }
    }
  }
`;

const ESTIMATE_SHIPPING_METHODS = `
  mutation EstimateShippingMethods(
    $cartId: String!
    $address: EstimateAddressInput!
  ) {
    estimateShippingMethods(input: { cart_id: $cartId, address: $address }) {
      carrier_code
      carrier_title
      method_code
      method_title
      amount { value currency }
      price_excl_tax { value currency }
      price_incl_tax { value currency }
    }
  }
`;

const SET_SHIPPING_METHOD = `
  mutation SetShippingMethod(
    $cartId: String!
    $shippingMethods: [ShippingMethodInput]!
  ) {
    setShippingMethodsOnCart(
      input: { cart_id: $cartId, shipping_methods: $shippingMethods }
    ) {
      cart { id }
    }
  }
`;

const SET_BILLING_ADDRESS = `
  mutation SetBillingAddress(
    $cartId: String!
    $billingAddress: BillingAddressInput!
  ) {
    setBillingAddressOnCart(
      input: { cart_id: $cartId, billing_address: $billingAddress }
    ) {
      cart { id }
    }
  }
`;

const SET_PAYMENT_METHOD = `
  mutation SetPaymentMethod($cartId: String!, $input: PaymentMethodInput!) {
    setPaymentMethodOnCart(
      input: { cart_id: $cartId, payment_method: $input }
    ) {
      cart { id selected_payment_method { code title } }
    }
  }
`;

const SET_PAAS_PAYMENT_METHOD = `
  mutation SetPaaSPaymentMethod($cartId: String!, $clientSecret: String!) {
    setPaymentMethodOnCart(
      input: {
        cart_id: $cartId
        payment_method: {
          code: "oope_stripe"
          oope_stripe: { client_secret: $clientSecret }
        }
      }
    ) {
      cart { id selected_payment_method { code title } }
    }
  }
`;

const PLACE_ORDER = `
  mutation PlaceOrder($cartId: String!) {
    placeOrder(input: { cart_id: $cartId }) {
      orderV2 { number token }
      errors { code message }
    }
  }
`;

const dom = {
  addProductButton: document.querySelector("#add-product-button"),
  blocker: document.querySelector("#checkout-blocker"),
  cartForm: document.querySelector("#cart-form"),
  cartId: document.querySelector("#cart-id"),
  cartStatus: document.querySelector("#cart-status"),
  clearLogButton: document.querySelector("#clear-log-button"),
  copyLogButton: document.querySelector("#copy-log-button"),
  clearSessionButton: document.querySelector("#clear-session-button"),
  commerceUrl: document.querySelector("#commerce-url"),
  configurationForm: document.querySelector("#configuration-form"),
  connectionStatus: document.querySelector("#connection-status"),
  createCartButton: document.querySelector("#create-cart-button"),
  customerToken: document.querySelector("#customer-token"),
  environmentPreset: document.querySelector("#environment-preset"),
  expressCheckoutSection: document.querySelector("#express-checkout-section"),
  log: document.querySelector("#storefront-log"),
  paymentContent: document.querySelector("#payment-content"),
  paymentStatus: document.querySelector("#payment-status"),
  orderSuccess: document.querySelector("#order-success"),
  orderSuccessMessage: document.querySelector("#order-success-message"),
  orderSuccessTitle: document.querySelector("#order-success-title"),
  startOverButton: document.querySelector("#start-over-button"),
  productQuantity: document.querySelector("#product-quantity"),
  productSku: document.querySelector("#product-sku"),
  refreshCartButton: document.querySelector("#refresh-cart-button"),
  runtimeBaseUrl: document.querySelector("#runtime-base-url"),
  storeCode: document.querySelector("#store-code"),
  summaryCapture: document.querySelector("#summary-capture"),
  summaryCustomer: document.querySelector("#summary-customer"),
  summaryShippingAddress: document.querySelector("#summary-shipping-address"),
  summaryShippingMethod: document.querySelector("#summary-shipping-method"),
  summaryStripe: document.querySelector("#summary-stripe"),
  summaryTotal: document.querySelector("#summary-total"),
  wallet: document.querySelector("#express-checkout-element"),
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
    element.dataset.state = status;
  } else {
    delete element.dataset.state;
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
  if (!/^https?:\/\//i.test(commerceUrl)) {
    throw new Error(TEXT.invalidConfiguration);
  }

  return {
    commerceUrl,
    customerToken: dom.customerToken.value.trim(),
    runtimeBaseUrl: normalizeBaseUrl(dom.runtimeBaseUrl.value),
    storeCode: dom.storeCode.value.trim() || "default",
  };
}

function savePublicConfiguration(config) {
  window.localStorage.setItem(
    CONFIG_STORAGE_KEY,
    JSON.stringify({
      commerceUrl: config.commerceUrl,
      runtimeBaseUrl: config.runtimeBaseUrl,
      storeCode: config.storeCode,
      environmentPreset: dom.environmentPreset.value || "",
    })
  );
  syncStorageActionAvailability();
}

function restoreConfiguration() {
  try {
    const config = JSON.parse(
      window.localStorage.getItem(CONFIG_STORAGE_KEY) || "null"
    );
    if (config) {
      dom.commerceUrl.value = config.commerceUrl || "";
      dom.runtimeBaseUrl.value = config.runtimeBaseUrl || "";
      dom.storeCode.value = config.storeCode || "default";
      if (config.environmentPreset && ENVIRONMENTS[config.environmentPreset]) {
        dom.environmentPreset.value = config.environmentPreset;
      } else {
        syncEnvironmentPresetSelection();
      }
    }
  } catch (error) {
    console.warn(
      "Unable to restore standalone storefront configuration.",
      error
    );
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

  syncStorageActionAvailability();
  log("configuration/environment-preset", {
    environment: presetKey,
    commerceGraphqlUrl: preset.commerceGraphqlUrl,
    productSku: preset.productSku,
  });

  if (notify) {
    notifySuccess(`Loaded ${preset.label} preset.`);
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
    "Content-Type": "application/json",
    Store: config.storeCode,
    ...(config.customerToken
      ? { Authorization: `Bearer ${config.customerToken}` }
      : {}),
  };
}

async function commerceGraphql(query, variables = {}) {
  const config = getConfig();
  const response = await fetch(config.commerceUrl, {
    method: "POST",
    credentials: "include",
    headers: getCommerceHeaders(),
    body: JSON.stringify({ query, variables }),
  });
  const result = await response.json().catch(() => null);

  if (!response.ok || result?.errors?.length) {
    const message =
      result?.errors?.map((error) => error.message).join(" ") ||
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

function syncCartActionAvailability() {
  const disabled = !hasCartId();
  dom.addProductButton.disabled = disabled;
  dom.refreshCartButton.disabled = disabled;
  syncStorageActionAvailability();
}

function syncCreateCartAvailability() {
  dom.createCartButton.disabled = !state.connected;
  syncStorageActionAvailability();
}

function hasLocalSession() {
  return Boolean(
    window.localStorage.getItem(CONFIG_STORAGE_KEY) ||
      window.sessionStorage.getItem(CART_STORAGE_KEY) ||
      state.connected ||
      state.cart ||
      hasCartId() ||
      dom.commerceUrl.value.trim() ||
      dom.runtimeBaseUrl.value.trim() ||
      dom.customerToken.value.trim() ||
      (dom.storeCode.value.trim() &&
        dom.storeCode.value.trim() !== "default") ||
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
  const purgeButton = document.querySelector("#purge-local-storage-button");
  if (purgeButton) {
    purgeButton.disabled = !hasLocalStorageData();
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
  log("configuration/commerce-url-changed", {
    previousCommerceUrl,
    commerceUrl: nextUrl,
    clearedCart: hadCart,
  });
  notifyWarning(
    hadCart
      ? "Adobe Commerce URL changed. Connection and cart were cleared — connect again."
      : "Adobe Commerce URL changed. Connection was cleared — connect again."
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
      createPaymentIntentUrl: `${config.runtimeBaseUrl}/payment-intent`,
      getInitParamsUrl: `${config.runtimeBaseUrl}/init-params`,
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
  setBadge(dom.cartStatus, TEXT.loading, "loading");

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
    throw new Error("The authoritative cart total is unavailable.");
  }
  return {
    amount: Math.round(Number(money.value) * 100),
    currency: String(money.currency).toLowerCase(),
  };
}

function formatMoney(money) {
  if (!money) {
    return "—";
  }
  try {
    return new Intl.NumberFormat(undefined, {
      currency: money.currency,
      style: "currency",
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
    cart?.id ? "success" : ""
  );
  dom.summaryCustomer.textContent = isAuthenticated
    ? TEXT.customerRegistered
    : `${TEXT.guest}${cart?.email ? ` (${cart.email})` : ""}`;
  dom.summaryTotal.textContent = formatMoney(cart?.prices?.grand_total);
  dom.summaryShippingAddress.textContent = shippingAddress
    ? [shippingAddress.street?.[0], shippingAddress.city]
        .filter(Boolean)
        .join(", ") || TEXT.available
    : TEXT.missing;
  dom.summaryShippingMethod.textContent = shippingMethod
    ? [shippingMethod.carrier_title, shippingMethod.method_title]
        .filter(Boolean)
        .join(" — ")
    : TEXT.missing;
  dom.summaryStripe.textContent = getStripePaymentMethod(cart)
    ? TEXT.available
    : TEXT.notAvailable;
  dom.summaryCapture.textContent =
    state.initParams?.elementsOptions?.captureMethod || "—";
}

function hideOrderSuccess() {
  dom.orderSuccess.hidden = true;
  dom.orderSuccessMessage.textContent = "";
  dom.paymentContent.hidden = false;
}

function showOrderSuccess(order, paymentIntentStatus) {
  dom.orderSuccessTitle.textContent =
    paymentIntentStatus === "requires_capture"
      ? TEXT.paymentAuthorized
      : TEXT.paymentSuccessful;
  dom.orderSuccessMessage.textContent = TEXT.orderConfirmed(order?.number);
  dom.paymentContent.hidden = true;
  dom.orderSuccess.hidden = false;
}

async function refreshCart({ synchronizeElement = true } = {}) {
  setBadge(dom.cartStatus, TEXT.loading, "loading");
  const cart = await fetchCart();
  if (!cart) {
    throw new Error(TEXT.cartMissing);
  }

  state.cart = cart;
  state.runtimeConfig = getStripePaymentMethod(cart)
    ? discoverRuntimeConfig(cart)
    : null;
  renderCartSummary();
  log("cart/refreshed", {
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
  return `${encodeURIComponent(method.carrier_code)}:${encodeURIComponent(method.method_code)}`;
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
      [method.carrier_title, method.method_title].filter(Boolean).join(" — ") ||
      method.method_code,
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
      console.warn("Unable to destroy Express Checkout Element.", error);
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
  dom.expressCheckoutSection.classList.add("hidden");
  dom.wallet.classList.remove("opacity-25");
  if (message) {
    setBadge(dom.paymentStatus, message, "error");
  }
}

function showExpressCheckout() {
  if (state.elementLoadFailed) {
    return;
  }
  dom.expressCheckoutSection.classList.remove("hidden");
  dom.wallet.classList.remove("opacity-25");
  setBadge(dom.paymentStatus, TEXT.ready, "success");
}

function setCheckoutBlocked(blocked) {
  dom.blocker.hidden = !blocked;
  document.body.setAttribute("aria-busy", String(blocked));
}

function handleModalDismissed() {
  const wasOpen = state.modalOpen || !dom.blocker.hidden;
  state.modalOpen = false;
  if (!state.confirmationInProgress) {
    setCheckoutBlocked(false);
    if (wasOpen) {
      log("wallet/dismissed");
    }
    synchronizeExpressCheckout();
  }
}

function splitName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 2) {
    throw new Error("The wallet must provide a first and last name.");
  }
  return { firstname: parts.shift(), lastname: parts.join(" ") };
}

function toCommerceAddress(walletAddress, phone) {
  const name = splitName(walletAddress?.name);
  const address = walletAddress?.address;
  if (
    !address?.line1 ||
    !address?.city ||
    !address?.country ||
    !address?.postal_code
  ) {
    throw new Error("The wallet address is incomplete.");
  }
  return {
    ...name,
    street: [address.line1, address.line2].filter(Boolean),
    city: address.city,
    country_code: address.country,
    postcode: address.postal_code,
    ...(address.state ? { region: address.state } : {}),
    ...(phone ? { telephone: phone } : {}),
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
    const fullWalletAddress = { address: event.address, name: event.name };
    if (
      event.name &&
      event.address?.line1 &&
      event.address?.city &&
      event.address?.country &&
      event.address?.postal_code
    ) {
      await setShippingAddress(
        fullWalletAddress,
        event.phone || event.phoneNumber
      );
      await refreshCart({ synchronizeElement: false });
      methods = getShippingMethods();
    }

    if (methods.length === 0) {
      methods = await estimateShippingMethods(event.address);
    }
    const shippingRates = setAvailableShippingMethods(methods);
    event.resolve({ shippingRates });
    log("wallet/shipping-address-change", {
      persisted: state.walletShippingAddressPersisted,
      shippingRates,
    });
  } catch (error) {
    console.warn("Unable to process the wallet shipping address.", error);
    event.reject();
    log("wallet/shipping-address-error", { message: error.message });
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
        throw new Error("The cart currency changed during wallet checkout.");
      }
      if (money.amount !== state.currentAmount) {
        await state.elements.update({ amount: money.amount });
        state.currentAmount = money.amount;
      }
    }

    event.resolve({ shippingRates: state.currentShippingRates });
    log("wallet/shipping-rate-change", {
      carrierCode: method.carrier_code,
      methodCode: method.method_code,
    });
  } catch (error) {
    console.warn("Unable to persist the wallet shipping method.", error);
    event.reject();
    log("wallet/shipping-rate-error", { message: error.message });
  }
}

function toStripeBillingDetails(event) {
  if (event.billingDetails) {
    return {
      name: event.billingDetails.name,
      email: event.billingDetails.email || state.cart?.email,
      phone: event.billingDetails.phone,
      address: event.billingDetails.address,
    };
  }

  const address = state.cart?.billing_address;
  if (!address) {
    return null;
  }
  return {
    name: `${address.firstname || ""} ${address.lastname || ""}`.trim(),
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
  return `${address?.firstname || ""} ${address?.lastname || ""}`.trim();
}

async function synchronizeWalletDetails(event) {
  const config = getConfig();
  const billingDetails = event.billingDetails;
  if (!config.customerToken && !state.cart?.email) {
    const email = billingDetails?.email;
    if (!email) {
      throw new Error("The wallet did not provide the required guest email.");
    }
    await commerceGraphql(SET_GUEST_EMAIL, {
      cartId: state.cartId,
      email,
    });
  }

  if (event.shippingAddress) {
    await setShippingAddress(event.shippingAddress, billingDetails?.phone);
  }

  const selectedMethod =
    state.shippingMethodsByRateId.get(event.shippingRate?.id) ||
    state.pendingShippingMethod;
  if (selectedMethod) {
    await setShippingMethod(selectedMethod);
  }

  if (!isCompleteBillingAddress() && billingDetails?.address) {
    await commerceGraphql(SET_BILLING_ADDRESS, {
      cartId: state.cartId,
      billingAddress: {
        address: toCommerceAddress(
          {
            name: billingDetails.name,
            address: billingDetails.address,
          },
          billingDetails.phone
        ),
      },
    });
  }

  return refreshCart({ synchronizeElement: false });
}

async function createPaymentIntent(confirmationTokenId) {
  const config = getConfig();
  const response = await fetch(state.runtimeConfig.createPaymentIntentUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Store: config.storeCode,
      ...(config.customerToken
        ? { Authorization: `Bearer ${config.customerToken}` }
        : {}),
    },
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
      data?.error || data?.message || "Unable to create the PaymentIntent."
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
        additional_data: [{ key: "client_secret", value: clientSecret }],
      },
    });
  } catch (genericError) {
    log("commerce/payment-method-generic-fallback", {
      message: genericError.message,
    });
    await commerceGraphql(SET_PAAS_PAYMENT_METHOD, {
      cartId: state.cartId,
      clientSecret,
    });
  }
}

function notifyPaymentFailure(event, reason = "fail") {
  if (typeof event.paymentFailed === "function") {
    event.paymentFailed({ reason });
  }
}

async function placeOrder() {
  const data = await commerceGraphql(PLACE_ORDER, { cartId: state.cartId });
  const result = data?.placeOrder;
  if (result?.errors?.length) {
    throw new Error(result.errors.map((error) => error.message).join(" "));
  }
  if (!result?.orderV2) {
    throw new Error("Commerce did not return the placed order.");
  }
  return result.orderV2;
}

async function runConfirmation(event) {
  state.confirmationInProgress = true;
  state.modalOpen = true;
  setCheckoutBlocked(true);
  setBadge(dom.paymentStatus, TEXT.loading, "loading");
  log("payment/started", {
    cartId: state.cartId,
    amount: state.currentAmount,
    currency: state.currentCurrency,
  });

  try {
    await synchronizeWalletDetails(event);
    const synchronizedMoney = getCartMoney();
    if (
      synchronizedMoney.currency !== state.currentCurrency ||
      synchronizedMoney.amount !== state.currentAmount
    ) {
      if (synchronizedMoney.currency === state.currentCurrency) {
        await state.elements.update({ amount: synchronizedMoney.amount });
        state.currentAmount = synchronizedMoney.amount;
      }
      notifyPaymentFailure(event, "invalid_shipping_address");
      setBadge(dom.paymentStatus, TEXT.ready, "success");
      log("payment/reauthorization-required", synchronizedMoney);
      return false;
    }

    const submitResult = await state.elements.submit();
    if (submitResult?.error) {
      notifyPaymentFailure(event, "invalid_payment_data");
      throw submitResult.error;
    }

    const billingDetails = toStripeBillingDetails(event);
    const confirmationTokenResult = await state.stripe.createConfirmationToken({
      elements: state.elements,
      params: {
        ...(billingDetails
          ? { payment_method_data: { billing_details: billingDetails } }
          : {}),
        ...(event.shippingAddress
          ? {
              shipping: {
                name: event.shippingAddress.name,
                phone: event.billingDetails?.phone || null,
                address: event.shippingAddress.address,
              },
            }
          : {}),
      },
    });
    if (
      confirmationTokenResult.error ||
      !confirmationTokenResult.confirmationToken?.id
    ) {
      notifyPaymentFailure(event, "invalid_payment_data");
      throw (
        confirmationTokenResult.error ||
        new Error("Stripe did not create a Confirmation Token.")
      );
    }

    const confirmationTokenId = confirmationTokenResult.confirmationToken.id;
    log("payment/confirmation-token-created", {
      confirmationTokenId,
    });

    const paymentIntentData = await createPaymentIntent(confirmationTokenId);
    log("payment/intent-created", {
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
      redirect: "if_required",
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
        `Unexpected PaymentIntent status: ${confirmationResult.paymentIntent.status}`
      );
    }

    const paymentIntent = confirmationResult.paymentIntent;
    log("payment/succeeded", {
      paymentIntentId: paymentIntent?.id,
      status: paymentIntent?.status,
      amount: paymentIntent?.amount,
      currency: paymentIntent?.currency,
      captureMethod: paymentIntent?.capture_method,
      confirmationTokenId,
    });

    const order = await placeOrder();
    setBadge(dom.paymentStatus, TEXT.orderPlaced, "success");
    showOrderSuccess(order, paymentIntent?.status);
    log("order/placed", {
      orderNumber: order?.number,
      orderId: order?.id,
      paymentIntentId: paymentIntent?.id,
      paymentStatus: paymentIntent?.status,
    });
    notifySuccess(
      paymentIntent?.status === "requires_capture"
        ? TEXT.paymentAuthorized
        : TEXT.paymentSuccessful
    );
    persistCartId(null);
    state.cart = null;
    destroyExpressCheckout();
    return true;
  } catch (error) {
    console.warn("Standalone Express Checkout confirmation failed.", error);
    notifyPaymentFailure(event);
    setBadge(dom.paymentStatus, TEXT.paymentFailed, "error");
    log("payment/failed", {
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
  state.expressCheckoutElement.on("click", (event) => {
    state.modalOpen = true;
    setCheckoutBlocked(true);
    log("wallet/clicked", {
      cartId: state.cartId,
      amount: state.currentAmount,
      currency: state.currentCurrency,
    });
    event.resolve({ shippingRates: state.currentShippingRates });
  });
  state.expressCheckoutElement.on("confirm", handleConfirm);
  state.expressCheckoutElement.on(
    "shippingaddresschange",
    handleShippingAddressChange
  );
  state.expressCheckoutElement.on(
    "shippingratechange",
    handleShippingRateChange
  );
  state.expressCheckoutElement.on("cancel", handleModalDismissed);
  state.expressCheckoutElement.on("escape", handleModalDismissed);
  state.expressCheckoutElement.on("loaderror", (event) => {
    console.warn(
      "Stripe Express Checkout Element failed to load.",
      event.error
    );
    state.elementLoadFailed = true;
    log("wallet/loaderror", {
      message: event.error?.message,
      type: event.error?.type,
      code: event.error?.code,
    });
    handleModalDismissed();
    hideExpressCheckout();
  });
  state.expressCheckoutElement.on("ready", (event) => {
    if (event.availablePaymentMethods) {
      log("wallet/ready", {
        availablePaymentMethods: event.availablePaymentMethods,
      });
      showExpressCheckout();
    } else {
      log("wallet/unavailable", { reason: TEXT.walletUnavailable });
      hideExpressCheckout(TEXT.walletUnavailable);
    }
  });
  state.expressCheckoutElement.on("availablepaymentmethodschange", (event) => {
    if (event.paymentMethods) {
      log("wallet/payment-methods-changed", {
        paymentMethods: event.paymentMethods,
      });
      showExpressCheckout();
    } else {
      log("wallet/unavailable", { reason: TEXT.walletUnavailable });
      hideExpressCheckout(TEXT.walletUnavailable);
    }
  });
}

async function mountExpressCheckout() {
  if (!state.cart || !getStripePaymentMethod()) {
    hideExpressCheckout(TEXT.stripeMissing);
    return;
  }

  destroyExpressCheckout();
  dom.wallet.classList.add("opacity-25");
  dom.expressCheckoutSection.classList.remove("hidden");
  setBadge(dom.paymentStatus, TEXT.loading, "loading");

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
      mode: "payment",
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
      "expressCheckout",
      getExpressCheckoutOptions()
    );
    registerExpressCheckoutHandlers();
    state.expressCheckoutElement.mount("#express-checkout-element");
    state.configurationKey = getConfigurationKey();
    renderCartSummary();
    log("stripe/mounted", elementsOptions);
  } catch (error) {
    console.warn(TEXT.initializationFailed, error);
    hideExpressCheckout(TEXT.initializationFailed);
    log("stripe/initialization-error", { message: error.message });
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
  setBadge(dom.connectionStatus, TEXT.connecting, "loading");
  try {
    const config = getConfig();
    if (
      state.connectedCommerceUrl &&
      config.commerceUrl !== state.connectedCommerceUrl
    ) {
      const hadCart = Boolean(state.cartId || state.cart);
      clearCartSession();
      if (hadCart) {
        notifyWarning(
          "Adobe Commerce URL changed. Previous cart was cleared before connecting."
        );
      }
    }
    savePublicConfiguration(config);
    setConnected(true, config.commerceUrl);
    setBadge(dom.connectionStatus, TEXT.connected, "success");
    if (dom.cartId.value.trim() || config.customerToken) {
      await refreshCart();
    }
    log("configuration/connected", {
      commerceUrl: config.commerceUrl,
      authenticated: Boolean(config.customerToken),
      storeCode: config.storeCode,
    });
    notifySuccess("Storefront connected.");
  } catch (error) {
    setConnected(false);
    setBadge(dom.connectionStatus, error.message, "error");
    log("configuration/error", { message: error.message });
    notifyError(error.message || "Unable to connect.");
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
    log("cart/ready", {
      cartId: state.cartId,
      total: state.cart?.prices?.grand_total,
    });
    notifySuccess(state.cartId ? `Cart ready: ${state.cartId}` : "Cart ready.");
  } catch (error) {
    setBadge(dom.cartStatus, error.message, "error");
    log("cart/create-error", { message: error.message });
    notifyError(error.message || "Unable to create or load cart.");
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

  dom.addProductButton.disabled = true;
  try {
    const cartId = dom.cartId.value.trim() || state.cartId;
    persistCartId(cartId);
    const sku = dom.productSku.value.trim();
    const quantity = Number(dom.productQuantity.value);
    if (!sku || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("Enter a product SKU and positive quantity.");
    }
    const data = await commerceGraphql(ADD_PRODUCT, {
      cartId: state.cartId,
      sku,
      quantity,
    });
    const userErrors = data?.addProductsToCart?.user_errors || [];
    if (userErrors.length) {
      throw new Error(userErrors.map((error) => error.message).join(" "));
    }
    await refreshCart();
    setBadge(dom.cartStatus, TEXT.addedProduct, "success");
    log("cart/product-added", {
      cartId: state.cartId,
      sku,
      quantity,
      total: state.cart?.prices?.grand_total,
    });
    notifySuccess(`Added ${quantity} × ${sku}.`);
  } catch (error) {
    setBadge(dom.cartStatus, error.message, "error");
    log("cart/add-product-error", { message: error.message });
    notifyError(error.message || "Unable to add product.");
  } finally {
    syncCartActionAvailability();
  }
}

async function handleRefreshCart() {
  if (!hasCartId()) {
    notifyError(TEXT.cartMissing);
    return;
  }

  dom.refreshCartButton.disabled = true;
  try {
    await refreshCart();
    notifySuccess("Cart refreshed.");
  } catch (error) {
    setBadge(dom.cartStatus, TEXT.refreshFailed, "error");
    log("cart/refresh-error", { message: error.message });
    notifyError(error.message || TEXT.refreshFailed);
  } finally {
    syncCartActionAvailability();
  }
}

function clearLocalSession({
  notifyMessage = "Local session cleared.",
} = {}) {
  if (!hasLocalSession() && dom.orderSuccess.hidden) {
    return;
  }

  window.localStorage.removeItem(CONFIG_STORAGE_KEY);
  clearCartSession();
  setConnected(false);
  dom.commerceUrl.value = "";
  dom.runtimeBaseUrl.value = "";
  dom.customerToken.value = "";
  dom.storeCode.value = "default";
  dom.productSku.value = "";
  dom.productQuantity.value = "1";
  dom.environmentPreset.value = "";
  dom.log.textContent = "";
  syncLogActionsAvailability();
  syncStorageActionAvailability();
  setBadge(dom.connectionStatus, TEXT.notConnected);
  notifySuccess(notifyMessage);
}

dom.configurationForm.addEventListener("submit", handleConnect);
dom.environmentPreset.addEventListener("change", (event) => {
  const presetKey = event.target.value;
  if (!presetKey) {
    return;
  }
  applyEnvironmentPreset(presetKey);
});
dom.commerceUrl.addEventListener("change", () => {
  handleCommerceUrlChange();
  syncEnvironmentPresetSelection();
});
dom.runtimeBaseUrl.addEventListener("change", syncEnvironmentPresetSelection);
dom.createCartButton.addEventListener("click", handleCreateCart);
dom.cartForm.addEventListener("submit", handleAddProduct);
dom.cartId.addEventListener("input", syncCartActionAvailability);
dom.refreshCartButton.addEventListener("click", handleRefreshCart);
dom.clearSessionButton.addEventListener("click", clearLocalSession);
dom.startOverButton.addEventListener("click", () => {
  clearLocalSession({ notifyMessage: "Storefront reset. Connect again to start over." });
  window.scrollTo({ top: 0, behavior: "smooth" });
});
dom.clearLogButton.addEventListener("click", () => {
  dom.log.textContent = "";
  syncLogActionsAvailability();
  syncStorageActionAvailability();
  notifySuccess("Checkout log cleared.");
});

window.addEventListener("storefront:storage-changed", syncStorageActionAvailability);

[
  dom.commerceUrl,
  dom.runtimeBaseUrl,
  dom.customerToken,
  dom.storeCode,
].forEach((input) => {
  input.addEventListener("input", syncStorageActionAvailability);
  input.addEventListener("change", syncStorageActionAvailability);
});

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("Copy command failed.");
    }
  } finally {
    textarea.remove();
  }
}

dom.copyLogButton.addEventListener("click", async () => {
  const text = dom.log.textContent || "";
  if (!text.trim()) {
    notifyError("Checkout log is empty.");
    return;
  }

  try {
    await copyTextToClipboard(text);
    notifySuccess("Checkout log copied.");
  } catch {
    notifyError("Unable to copy the checkout log.");
  }
});

restoreConfiguration();
renderCartSummary();
syncCreateCartAvailability();
syncCartActionAvailability();
syncLogActionsAvailability();
syncStorageActionAvailability();
