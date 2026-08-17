export const STRIPE_PAYMENT_METHOD_CODE = "oope_stripe";

export const CONFIG_STORAGE_KEY = "STRIPE_ECE_STOREFRONT_CONFIG";
export const CART_STORAGE_KEY = "STRIPE_ECE_STOREFRONT_CART_ID";
export const LEGACY_CONFIGURATION_STORAGE_KEY = "configuration";

export const DEFAULT_STORE_CODE = "default";
export const DEFAULT_PRODUCT_QUANTITY = "1";
export const EMPTY_DISPLAY = "—";
export const JSON_NULL = "null";

export const COMMERCE_URL_PATTERN = /^https?:\/\//i;
export const WALLET_NAME_SPLIT_PATTERN = /\s+/;

export const STRIPE_PAYMENT_STATUS = Object.freeze({
  PROCESSING: "processing",
  REQUIRES_CAPTURE: "requires_capture",
  SUCCEEDED: "succeeded",
});

export const SUPPORTED_PAYMENT_STATUSES = new Set([
  STRIPE_PAYMENT_STATUS.PROCESSING,
  STRIPE_PAYMENT_STATUS.REQUIRES_CAPTURE,
  STRIPE_PAYMENT_STATUS.SUCCEEDED,
]);

export const STRIPE = Object.freeze({
  ELEMENT_TYPE: "expressCheckout",
  ELEMENTS_MODE: "payment",
  REDIRECT: "if_required",
  CLIENT_SECRET_KEY: "client_secret",
  EVENT: Object.freeze({
    CLICK: "click",
    CONFIRM: "confirm",
    SHIPPING_ADDRESS_CHANGE: "shippingaddresschange",
    SHIPPING_RATE_CHANGE: "shippingratechange",
    CANCEL: "cancel",
    ESCAPE: "escape",
    LOAD_ERROR: "loaderror",
    READY: "ready",
    AVAILABLE_PAYMENT_METHODS_CHANGE: "availablepaymentmethodschange",
  }),
  PAYMENT_FAILED_REASON: Object.freeze({
    FAIL: "fail",
    INVALID_SHIPPING_ADDRESS: "invalid_shipping_address",
    INVALID_PAYMENT_DATA: "invalid_payment_data",
  }),
});

export const RUNTIME_PATH = Object.freeze({
  PAYMENT_INTENT: "/payment-intent",
  INIT_PARAMS: "/init-params",
});

export const HTTP = Object.freeze({
  METHOD_POST: "POST",
  CONTENT_TYPE: "Content-Type",
  CONTENT_TYPE_JSON: "application/json",
  HEADER_STORE: "Store",
  HEADER_AUTHORIZATION: "Authorization",
  BEARER_PREFIX: "Bearer ",
  CREDENTIALS_INCLUDE: "include",
});

export const NUMBER_FORMAT = Object.freeze({
  STYLE_CURRENCY: "currency",
});

export const BADGE_STATE = Object.freeze({
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error",
});

export const CSS_CLASS = Object.freeze({
  HIDDEN: "hidden",
  OPACITY_25: "opacity-25",
});

export const ARIA = Object.freeze({
  BUSY: "aria-busy",
});

export const DATASET = Object.freeze({
  STATE: "state",
});

export const DOM_EVENT = Object.freeze({
  DOM_CONTENT_LOADED: "DOMContentLoaded",
  CHANGE: "change",
  CLICK: "click",
  INPUT: "input",
  SUBMIT: "submit",
});

export const HTML_ELEMENT = Object.freeze({
  DIV: "div",
  SPAN: "span",
  BUTTON: "button",
  PARAGRAPH: "p",
  TEXTAREA: "textarea",
});

export const HTML_ATTR = Object.freeze({
  ROLE: "role",
  ARIA_LABEL: "aria-label",
});

export const SEPARATOR = Object.freeze({
  COMMA: ", ",
  EM_DASH: " — ",
  SPACE: " ",
  COLON: ":",
});

export const CLIPBOARD = Object.freeze({
  POSITION: "fixed",
  LEFT: "-9999px",
  READONLY: "readonly",
  EXEC_COMMAND: "copy",
});

export const WINDOW_SCROLL_TOP = Object.freeze({
  top: 0,
  behavior: "smooth",
});

export const SELECTOR = Object.freeze({
  addProductButton: "#add-product-button",
  blocker: "#checkout-blocker",
  cartForm: "#cart-form",
  cartId: "#cart-id",
  cartStatus: "#cart-status",
  clearLogButton: "#clear-log-button",
  copyLogButton: "#copy-log-button",
  clearSessionButton: "#clear-session-button",
  commerceUrl: "#commerce-url",
  configurationForm: "#configuration-form",
  connectionStatus: "#connection-status",
  createCartButton: "#create-cart-button",
  customerToken: "#customer-token",
  environmentPreset: "#environment-preset",
  expressCheckoutSection: "#express-checkout-section",
  log: "#storefront-log",
  paymentContent: "#payment-content",
  paymentStatus: "#payment-status",
  orderSuccess: "#order-success",
  orderSuccessMessage: "#order-success-message",
  orderSuccessTitle: "#order-success-title",
  startOverButton: "#start-over-button",
  productQuantity: "#product-quantity",
  productSku: "#product-sku",
  runtimeBaseUrl: "#runtime-base-url",
  storeCode: "#store-code",
  summaryCapture: "#summary-capture",
  summaryCustomer: "#summary-customer",
  summaryShippingAddress: "#summary-shipping-address",
  summaryShippingMethod: "#summary-shipping-method",
  summaryStripe: "#summary-stripe",
  summaryTotal: "#summary-total",
  wallet: "#express-checkout-element",
  purgeLocalStorageButton: "#purge-local-storage-button",
});

export const ENVIRONMENTS = Object.freeze({
  saas: {
    label: "SaaS sandbox",
    commerceGraphqlUrl:
      "https://na1-sandbox.api.commerce.adobe.com/XjRnU4rfv1hG6ihVjmXJdi/graphql",
    appBuilderStripeActionBaseUrl:
      "https://890003-christostestappname-development.adobeioruntime.net/api/v1/web/stripe",
    productSku: "PSV-3003",
  },
  paas: {
    label: "PaaS development",
    commerceGraphqlUrl:
      "https://adobe-enterprise2.developmentcloud.net/graphql",
    appBuilderStripeActionBaseUrl:
      "https://890003-christostestappname-developmentpaas.adobeioruntime.net/api/v1/web/stripe",
    productSku: "24-MB04",
  },
});

export const TEXT = Object.freeze({
  addedProduct: "Product added",
  available: "Available",
  cartLoaded: "Cart loaded",
  cartMissing: "Create or load a cart first.",
  connected: "Connected",
  connecting: "Connecting…",
  customerRegistered: "Registered customer",
  guest: "Guest",
  guestWithEmail: (email) => `Guest (${email})`,
  fullName: (firstname, lastname) =>
    `${firstname || ""} ${lastname || ""}`.trim(),
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
  runtimeMissing: "Stripe runtime configuration is unavailable on this cart.",
  stripeMissing: "Stripe OOPE is not available on this cart.",
  walletUnavailable: "No supported wallet is available in this browser.",
  cartTotalUnavailable: "The authoritative cart total is unavailable.",
  walletNameRequired: "The wallet must provide a first and last name.",
  walletAddressIncomplete: "The wallet address is incomplete.",
  cartCurrencyChanged: "The cart currency changed during wallet checkout.",
  guestEmailRequired: "The wallet did not provide the required guest email.",
  paymentIntentCreateFailed: "Unable to create the PaymentIntent.",
  orderMissing: "Commerce did not return the placed order.",
  confirmationTokenMissing: "Stripe did not create a Confirmation Token.",
  unexpectedPaymentStatus: (status) =>
    `Unexpected PaymentIntent status: ${status}`,
  storefrontConnected: "Storefront connected.",
  connectFailed: "Unable to connect.",
  cartReady: (cartId) => (cartId ? `Cart ready: ${cartId}` : "Cart ready."),
  createCartFailed: "Unable to create or load cart.",
  productSkuRequired: "Enter a product SKU.",
  productSkuAndQuantityRequired: "Enter a product SKU and positive quantity.",
  addProductFailed: "Unable to add product.",
  addedSku: (quantity, sku) => `Added ${quantity} × ${sku}.`,
  localSessionCleared: "Local session cleared.",
  storefrontReset: "Storefront reset. Connect again to start over.",
  checkoutLogCleared: "Checkout log cleared.",
  checkoutLogEmpty: "Checkout log is empty.",
  checkoutLogCopied: "Checkout log copied.",
  copyLogFailed: "Unable to copy the checkout log.",
  copyCommandFailed: "Copy command failed.",
  loadedPreset: (label) => `Loaded ${label} preset.`,
  commerceUrlChangedWithCart:
    "Adobe Commerce URL changed. Connection and cart were cleared — connect again.",
  commerceUrlChangedWithoutCart:
    "Adobe Commerce URL changed. Connection was cleared — connect again.",
  commerceUrlChangedBeforeConnect:
    "Adobe Commerce URL changed. Previous cart was cleared before connecting.",
  purgedStorage: (count) =>
    `Cleared ${count} local storage key${count === 1 ? "" : "s"}.`,
});

export const CONSOLE = Object.freeze({
  restoreConfigurationFailed:
    "Unable to restore standalone storefront configuration.",
  destroyExpressCheckoutFailed: "Unable to destroy Express Checkout Element.",
  processShippingAddressFailed:
    "Unable to process the wallet shipping address.",
  persistShippingMethodFailed: "Unable to persist the wallet shipping method.",
  confirmationFailed: "Standalone Express Checkout confirmation failed.",
  expressCheckoutLoadFailed: "Stripe Express Checkout Element failed to load.",
});

export const LOG = Object.freeze({
  environmentPreset: "configuration/environment-preset",
  commerceUrlChanged: "configuration/commerce-url-changed",
  cartRefreshed: "cart/refreshed",
  walletDismissed: "wallet/dismissed",
  shippingAddressChange: "wallet/shipping-address-change",
  shippingAddressError: "wallet/shipping-address-error",
  shippingRateChange: "wallet/shipping-rate-change",
  shippingRateError: "wallet/shipping-rate-error",
  paymentMethodGenericFallback: "commerce/payment-method-generic-fallback",
  paymentStarted: "payment/started",
  reauthorizationRequired: "payment/reauthorization-required",
  confirmationTokenCreated: "payment/confirmation-token-created",
  intentCreated: "payment/intent-created",
  paymentSucceeded: "payment/succeeded",
  orderPlaced: "order/placed",
  paymentFailed: "payment/failed",
  walletClicked: "wallet/clicked",
  walletLoadError: "wallet/loaderror",
  walletReady: "wallet/ready",
  walletUnavailable: "wallet/unavailable",
  walletPaymentMethodsChanged: "wallet/payment-methods-changed",
  stripeMounted: "stripe/mounted",
  stripeInitializationError: "stripe/initialization-error",
  configurationConnected: "configuration/connected",
  configurationError: "configuration/error",
  cartReady: "cart/ready",
  cartCreateError: "cart/create-error",
  cartProductAdded: "cart/product-added",
  cartAddProductError: "cart/add-product-error",
});

export const NOTIFICATION = Object.freeze({
  DEFAULT_DURATION_MS: 3200,
  DISMISS_ANIMATION_MS: 180,
  TYPE: Object.freeze({
    SUCCESS: "success",
    ERROR: "error",
    INFO: "info",
    WARNING: "warning",
  }),
  TYPE_LABEL: Object.freeze({
    success: "Success",
    error: "Error",
    info: "Info",
    warning: "Warning",
  }),
  TYPE_BG: Object.freeze({
    success: "bg-emerald-700",
    error: "bg-red-700",
    info: "bg-blue-700",
    warning: "bg-amber-700",
  }),
  HOST_CLASS:
    "pointer-events-none fixed right-4 bottom-4 z-40 flex max-w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2.5 max-[700px]:inset-x-3 max-[700px]:bottom-3 max-[700px]:max-w-none",
  TOAST_BASE_CLASS:
    "pointer-events-auto grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 rounded-[10px] px-[0.9rem] py-[0.85rem] text-white opacity-0 shadow-[0_12px_30px_rgb(17_24_39_/_18%)] transition duration-[160ms] ease-out translate-y-2",
  ENTER_CLASSES: Object.freeze(["opacity-100", "translate-y-0"]),
  LEAVE_CLASSES: Object.freeze(["opacity-0", "translate-y-1.5"]),
  INITIAL_HIDDEN_CLASSES: Object.freeze(["opacity-0", "translate-y-2"]),
  LABEL_CLASS:
    "text-[0.72rem] font-bold tracking-[0.04em] uppercase opacity-80",
  BODY_CLASS: "col-start-1 m-0 text-[0.92rem] leading-snug",
  CLOSE_CLASS:
    "col-start-2 row-span-2 row-start-1 min-h-0 cursor-pointer self-start border-0 bg-transparent p-0 text-[1.1rem] leading-none font-bold text-inherit opacity-75 hover:bg-transparent hover:opacity-100",
  ROLE_ALERT: "alert",
  ROLE_STATUS: "status",
  ARIA_LIVE: "aria-live",
  ARIA_LIVE_POLITE: "polite",
  ARIA_RELEVANT: "aria-relevant",
  ARIA_RELEVANT_ADDITIONS: "additions",
  CLOSE_LABEL: "Dismiss notification",
  CLOSE_SYMBOL: "×",
  BUTTON: "button",
});

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

export const CREATE_GUEST_CART = `
  mutation CreateGuestCart {
    createGuestCart {
      cart { id }
    }
  }
`;

export const GET_GUEST_CART = `
  query GetGuestCart($cartId: String!) {
    cart(cart_id: $cartId) {
      ${CART_FIELDS}
    }
  }
`;

export const GET_CUSTOMER_CART = `
  query GetCustomerCart {
    cart: customerCart {
      ${CART_FIELDS}
    }
  }
`;

export const ADD_PRODUCT = `
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

export const SET_GUEST_EMAIL = `
  mutation SetGuestEmail($cartId: String!, $email: String!) {
    setGuestEmailOnCart(input: { cart_id: $cartId, email: $email }) {
      cart { id email }
    }
  }
`;

export const SET_SHIPPING_ADDRESS = `
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

export const ESTIMATE_SHIPPING_METHODS = `
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

export const SET_SHIPPING_METHOD = `
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

export const SET_BILLING_ADDRESS = `
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

export const SET_PAYMENT_METHOD = `
  mutation SetPaymentMethod($cartId: String!, $input: PaymentMethodInput!) {
    setPaymentMethodOnCart(
      input: { cart_id: $cartId, payment_method: $input }
    ) {
      cart { id selected_payment_method { code title } }
    }
  }
`;

export const SET_PAAS_PAYMENT_METHOD = `
  mutation SetPaaSPaymentMethod($cartId: String!, $clientSecret: String!) {
    setPaymentMethodOnCart(
      input: {
        cart_id: $cartId
        payment_method: {
          code: "${STRIPE_PAYMENT_METHOD_CODE}"
          oope_stripe: { client_secret: $clientSecret }
        }
      }
    ) {
      cart { id selected_payment_method { code title } }
    }
  }
`;

export const PLACE_ORDER = `
  mutation PlaceOrder($cartId: String!) {
    placeOrder(input: { cart_id: $cartId }) {
      orderV2 { number token }
      errors { code message }
    }
  }
`;
