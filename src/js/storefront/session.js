import {
  CART_STORAGE_KEY,
  CONFIG_STORAGE_KEY,
  DEFAULT_PRODUCT_QUANTITY,
  DEFAULT_STORE_CODE,
  TEXT,
} from "../constants.js";
import { notifySuccess } from "../notifications.js";
import { dom } from "./dom.js";
import { state } from "./state.js";
import { hasLogContent, setBadge, syncLogActionsAvailability } from "./logging.js";
import { clearCartSession } from "./cart.js";

export function persistCartId(cartId) {
  state.cartId = cartId || null;
  dom.cartId.value = cartId || "";
  if (cartId) {
    window.sessionStorage.setItem(CART_STORAGE_KEY, cartId);
  } else {
    window.sessionStorage.removeItem(CART_STORAGE_KEY);
  }
  syncCartActionAvailability();
}

export function hasCartId() {
  return Boolean(dom.cartId.value.trim() || state.cartId);
}

export function hasProductSku() {
  return Boolean(dom.productSku.value.trim());
}

export function syncCartActionAvailability() {
  dom.addProductButton.disabled = !hasCartId() || !hasProductSku();
  syncStorageActionAvailability();
}

export function syncCreateCartAvailability() {
  dom.createCartButton.disabled = !state.connected;
  syncStorageActionAvailability();
}

export function hasLocalSession() {
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

export function hasLocalStorageData() {
  return window.localStorage.length > 0;
}

export function syncStorageActionAvailability() {
  if (dom.clearSessionButton) {
    dom.clearSessionButton.disabled = !hasLocalSession();
  }
  if (dom.purgeLocalStorageButton) {
    dom.purgeLocalStorageButton.disabled = !hasLocalStorageData();
  }
}

export function setConnected(connected, commerceUrl = null) {
  state.connected = Boolean(connected);
  state.connectedCommerceUrl = state.connected
    ? String(commerceUrl || "").trim() || null
    : null;
  syncCreateCartAvailability();
}

/**
 * Reset connected state, cart session, form fields, and the checkout log.
 *
 * @param {{ notifyMessage?: string, force?: boolean }} [options]
 */
export const clearLocalSession = ({
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
export const handlePurgeLocalStorage = () => {
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
