import { DATASET } from "../constants.js";
import { dom } from "./dom.js";
import { syncStorageActionAvailability } from "./session.js";

export function setBadge(element, message, status = "") {
  element.textContent = message;
  if (status) {
    element.dataset[DATASET.STATE] = status;
  } else {
    delete element.dataset[DATASET.STATE];
  }
}

export function log(eventName, payload) {
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

export function hasLogContent() {
  return Boolean(dom.log.textContent?.trim());
}

export function syncLogActionsAvailability() {
  const disabled = !hasLogContent();
  dom.copyLogButton.disabled = disabled;
  dom.clearLogButton.disabled = disabled;
}
