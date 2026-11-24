import { GET_COUNTRY_REGIONS, LOG, TEXT } from "../constants.js";
import { dom } from "./dom.js";
import { state } from "./state.js";
import { log } from "./logging.js";
import { commerceGraphql } from "./config.js";
import { getSelectedRegion } from "./wallet-address.js";

/**
 * Commerce rejects a wallet address for a country with regions when no region
 * is sent, and wallets do not always provide one. The shopper picks it on the
 * page after the wallet sheet closes, then pays with the wallet again.
 */

function getCountryName(countryCode) {
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) ||
      countryCode
    );
  } catch {
    return countryCode;
  }
}

async function getCountryRegions(countryCode) {
  if (!state.countryRegions.has(countryCode)) {
    const data = await commerceGraphql(GET_COUNTRY_REGIONS, { countryCode });
    state.countryRegions.set(
      countryCode,
      data?.country?.available_regions || []
    );
  }
  return state.countryRegions.get(countryCode);
}

/**
 * Find the first wallet address whose country has regions but no region.
 * @param {...(Object|null)} walletAddresses Normalized wallet addresses, in priority order.
 * @returns {Promise<{countryCode: string, regions: Array}|null>}
 */
export async function findWalletAddressMissingRegion(...walletAddresses) {
  for (const wallet of walletAddresses) {
    const address = wallet?.address;
    if (!address?.country || address.state) {
      continue;
    }
    const countryCode = address.country.toUpperCase();
    if (getSelectedRegion(countryCode)) {
      continue;
    }
    const regions = await getCountryRegions(countryCode);
    if (regions.length) {
      return { countryCode, regions };
    }
  }
  return null;
}

/**
 * Show the region picker on the page with the regions for the country.
 * @param {{countryCode: string, regions: Array}} missing Result of findWalletAddressMissingRegion.
 */
export function showRegionPicker(missing) {
  state.regionOptions = missing;
  const placeholder = new Option(TEXT.regionPlaceholder, "");
  dom.regionSelect.replaceChildren(
    placeholder,
    ...missing.regions.map(
      (region) => new Option(region.name, String(region.id))
    )
  );
  dom.regionPickerMessage.textContent = TEXT.regionRequired(
    getCountryName(missing.countryCode)
  );
  dom.regionPicker.hidden = false;
}

/**
 * Store the region the shopper picked; it is used for the next wallet payment.
 * @param {Event} event Change event of the region select.
 */
export function handleRegionChange(event) {
  const options = state.regionOptions;
  const region = options?.regions.find(
    (candidate) => String(candidate.id) === event.target.value
  );
  if (!options || !region) {
    state.selectedRegion = null;
    return;
  }
  state.selectedRegion = {
    countryCode: options.countryCode,
    id: region.id,
    code: region.code,
    name: region.name,
  };
  dom.regionPickerMessage.textContent = TEXT.regionSaved(
    getCountryName(options.countryCode)
  );
  log(LOG.regionSelected, {
    countryCode: options.countryCode,
    regionCode: region.code,
  });
}
