// Shared mutable state for the standalone storefront. Modules import this
// single object and mutate its properties in place so every module observes
// the same live values.
export const state = {
  activeConfirmation: null,
  cart: null,
  cartId: null,
  configurationKey: null,
  confirmationInProgress: false,
  countryRegions: new Map(),
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
  regionOptions: null,
  runtimeConfig: null,
  selectedRegion: null,
  shippingMethodsByRateId: new Map(),
  stripe: null,
  walletReauthorizationRequired: false,
  walletShippingAddressPersisted: false,
};
