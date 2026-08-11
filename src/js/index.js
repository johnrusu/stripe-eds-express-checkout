import {
  isNilOrEmpty,
  addToLocalStorage,
  getFromLocalStorage,
  removeFromLocalStorage,
  purgeLocalStorage,
  isJsonValid,
} from "./utils.js";
import { notifySuccess } from "./notifications.js";

const LOCAL_STORAGE_KEY = "configuration";

const INPUTS_IDS = Object.freeze({
  COMMERCE_URL: "commerce-url",
  STORE_CODE: "store-code",
  RUNTIME_BASE_URL: "runtime-base-url",
  CUSTOMER_TOKEN: "customer-token",
  COMMERCE_GRAPHQL_URL: "commerce-graphql-url",
  CART_ID: "cart-id",
  PRODUCT_SKU: "product-sku",
  QUANTITY: "quantity",
});

const configuration = {};

const resetConfigurationInputs = () => {
  Object.keys(configuration).forEach((key) => {
    delete configuration[key];
  });

  Object.values(INPUTS_IDS).forEach((id) => {
    const input = document.querySelector(`#${id}`);
    if (!isNilOrEmpty(input)) {
      input.value = id === INPUTS_IDS.STORE_CODE ? "default" : "";
    }
  });
};

window.addEventListener("DOMContentLoaded", () => {
  // clear the local storage
  const jsonConfiguration = getFromLocalStorage(LOCAL_STORAGE_KEY);
  if (!isNilOrEmpty(jsonConfiguration)) {
    if (isJsonValid(jsonConfiguration)) {
      const jsonConfigurationObject = JSON.parse(jsonConfiguration);
      if (isNilOrEmpty(jsonConfigurationObject)) {
        removeFromLocalStorage(LOCAL_STORAGE_KEY);
      } else {
        // Initialize the configuration from the local storage
        Object.assign(configuration, jsonConfigurationObject);
        Object.values(INPUTS_IDS).forEach((id) => {
          if (!isNilOrEmpty(configuration[id])) {
            const input = document.querySelector(`#${id}`);
            if (!isNilOrEmpty(input)) {
              input.value = configuration[id];
            }
          }
        });
      }
    }
  }

  // Listen to input changes and update the configuration
  // and save it to the local storage
  Object.values(INPUTS_IDS).forEach((id) => {
    if (!isNilOrEmpty(id)) {
      const input = document.querySelector(`#${id}`);
      if (!isNilOrEmpty(input)) {
        input.addEventListener("change", (event) => {
          const value = event.target.value;
          if (!isNilOrEmpty(value)) {
            configuration[id] = value;
            const jsonConfiguration = JSON.stringify(configuration);
            addToLocalStorage(LOCAL_STORAGE_KEY, jsonConfiguration);
          } else {
            delete configuration[id];
            const jsonConfiguration = JSON.stringify(configuration);
            addToLocalStorage(LOCAL_STORAGE_KEY, jsonConfiguration);
          }
          window.dispatchEvent(new Event("storefront:storage-changed"));
        });
      }
    }
  });

  const purgeLocalStorageButton = document.querySelector(
    "#purge-local-storage-button"
  );
  if (!isNilOrEmpty(purgeLocalStorageButton)) {
    purgeLocalStorageButton.addEventListener("click", () => {
      if (window.localStorage.length === 0) {
        return;
      }
      const keys = purgeLocalStorage();
      resetConfigurationInputs();
      window.dispatchEvent(new Event("storefront:storage-changed"));
      notifySuccess(
        keys.length
          ? `Cleared ${keys.length} local storage key${keys.length === 1 ? "" : "s"}.`
          : "Local storage was already empty."
      );
    });
  }

  window.dispatchEvent(new Event("storefront:storage-changed"));
});
