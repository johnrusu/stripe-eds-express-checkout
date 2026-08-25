import {
  ADD_PRODUCT,
  BADGE_STATE,
  DOM_EVENT,
  LOG,
  SEPARATOR,
  TEXT,
  WINDOW_SCROLL_TOP,
} from "./constants.js";
import { notifyError, notifySuccess, notifyWarning } from "./notifications.js";
import { dom } from "./storefront/dom.js";
import { state } from "./storefront/state.js";
import { log, setBadge, syncLogActionsAvailability } from "./storefront/logging.js";
import {
  applyEnvironmentPreset,
  commerceGraphql,
  getConfig,
  persistPublicConfiguration,
  restoreConfiguration,
  savePublicConfiguration,
  syncEnvironmentPresetSelection,
} from "./storefront/config.js";
import {
  clearLocalSession,
  handlePurgeLocalStorage,
  hasCartId,
  hasProductSku,
  persistCartId,
  setConnected,
  syncCartActionAvailability,
  syncCreateCartAvailability,
  syncStorageActionAvailability,
} from "./storefront/session.js";
import {
  clearCartSession,
  createOrLoadCart,
  handleCommerceUrlChange,
  refreshCart,
  renderCartSummary,
} from "./storefront/cart.js";
import { copyTextToClipboard } from "./storefront/clipboard.js";

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
