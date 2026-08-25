import {
  COMMERCE_URL_PATTERN,
  CART_STORAGE_KEY,
  CONFIG_STORAGE_KEY,
  CONSOLE,
  DEFAULT_STORE_CODE,
  ENVIRONMENTS,
  HTTP,
  JSON_NULL,
  LEGACY_CONFIGURATION_STORAGE_KEY,
  LOG,
  SEPARATOR,
  TEXT,
} from "../constants.js";
import { notifySuccess } from "../notifications.js";
import { dom } from "./dom.js";
import { state } from "./state.js";
import { log } from "./logging.js";
import {
  syncCartActionAvailability,
  syncStorageActionAvailability,
} from "./session.js";
import { handleCommerceUrlChange } from "./cart.js";

export function normalizeBaseUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "");
}

export function getConfig() {
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

export function savePublicConfiguration(config) {
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

export const persistPublicConfiguration = () => {
  try {
    savePublicConfiguration(getConfig());
  } catch {
    return;
  }
};

export function restoreConfiguration() {
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

export function applyEnvironmentPreset(presetKey, { notify = true } = {}) {
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

export function syncEnvironmentPresetSelection() {
  const commerceUrl = dom.commerceUrl.value.trim();
  const runtimeBaseUrl = normalizeBaseUrl(dom.runtimeBaseUrl.value);
  const match = Object.entries(ENVIRONMENTS).find(
    ([, preset]) =>
      preset.commerceGraphqlUrl === commerceUrl &&
      normalizeBaseUrl(preset.appBuilderStripeActionBaseUrl) === runtimeBaseUrl
  );
  dom.environmentPreset.value = match?.[0] || "";
}

export function getCommerceHeaders() {
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

export async function commerceGraphql(query, variables = {}) {
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
