import { SEPARATOR, TEXT, WALLET_NAME_SPLIT_PATTERN } from "../constants.js";
import { state } from "./state.js";

/**
 * The region the shopper picked on the page for a country whose wallet
 * address has no region. Returns null when none was picked for that country.
 * @param {string} countryCode ISO country code from the wallet address.
 * @returns {{countryCode: string, id: number, code: string, name: string}|null}
 */
export function getSelectedRegion(countryCode) {
  const code = String(countryCode || "").toUpperCase();
  return state.selectedRegion?.countryCode === code ? state.selectedRegion : null;
}

export function splitName(name) {
  const parts = String(name || "")
    .trim()
    .split(WALLET_NAME_SPLIT_PATTERN)
    .filter(Boolean);
  if (parts.length < 2) {
    throw new Error(TEXT.walletNameRequired);
  }
  return { firstname: parts.shift(), lastname: parts.join(SEPARATOR.SPACE) };
}

export const readWalletValue = (...values) => {
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
export function toWalletAddress(source) {
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

export function isCompleteWalletAddress(walletAddress) {
  const address = walletAddress?.address;
  return Boolean(
    walletAddress?.name &&
    address?.line1 &&
    address?.city &&
    address?.country &&
    address?.postal_code
  );
}

export const firstCompleteWallet = (...wallets) =>
  wallets.find((wallet) => isCompleteWalletAddress(wallet)) || null;

export function toCommerceAddress(walletAddress, phone) {
  const normalized = toWalletAddress(walletAddress);
  if (!isCompleteWalletAddress(normalized)) {
    throw new Error(TEXT.walletAddressIncomplete);
  }
  const name = splitName(normalized.name);
  const address = normalized.address;
  const telephone = phone || normalized.phone;
  const selectedRegion = address.state
    ? null
    : getSelectedRegion(address.country);
  return {
    ...name,
    street: [address.line1, address.line2].filter(Boolean),
    city: address.city,
    country_code: address.country,
    postcode: address.postal_code,
    // Commerce defaults this to true. Wallet details are for this order only;
    // saving them again would duplicate customer addresses at order placement.
    save_in_address_book: false,
    ...(address.state ? { region: address.state } : {}),
    ...(selectedRegion
      ? { region_id: selectedRegion.id, region: selectedRegion.code }
      : {}),
    ...(telephone ? { telephone } : {}),
  };
}
