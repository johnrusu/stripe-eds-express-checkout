const DEFAULT_DURATION_MS = 3200;

const TYPE_LABEL = Object.freeze({
  success: "Success",
  error: "Error",
  info: "Info",
  warning: "Warning",
});

let host = null;

function ensureHost() {
  if (host && document.body.contains(host)) {
    return host;
  }

  host = document.createElement("div");
  host.className = "notification-host";
  host.setAttribute("aria-live", "polite");
  host.setAttribute("aria-relevant", "additions");
  document.body.appendChild(host);
  return host;
}

/**
 * Show a short toast for a button/action result.
 *
 * @param {string} message
 * @param {{ type?: "success" | "error" | "info" | "warning", durationMs?: number }} [options]
 */
export function notify(message, options = {}) {
  const text = String(message || "").trim();
  if (!text) {
    return null;
  }

  const type = TYPE_LABEL[options.type] ? options.type : "info";
  const durationMs =
    Number.isFinite(options.durationMs) && options.durationMs >= 0
      ? options.durationMs
      : DEFAULT_DURATION_MS;

  const toast = document.createElement("div");
  toast.className = `notification notification-${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");

  const label = document.createElement("span");
  label.className = "notification-label";
  label.textContent = TYPE_LABEL[type];

  const body = document.createElement("p");
  body.className = "notification-message";
  body.textContent = text;

  const close = document.createElement("button");
  close.type = "button";
  close.className = "notification-close";
  close.setAttribute("aria-label", "Dismiss notification");
  close.textContent = "×";

  toast.append(label, body, close);
  ensureHost().appendChild(toast);

  let removed = false;
  const dismiss = () => {
    if (removed) {
      return;
    }
    removed = true;
    toast.classList.add("notification-leave");
    window.setTimeout(() => {
      toast.remove();
    }, 180);
  };

  close.addEventListener("click", dismiss);

  if (durationMs > 0) {
    window.setTimeout(dismiss, durationMs);
  }

  requestAnimationFrame(() => {
    toast.classList.add("notification-enter");
  });

  return { dismiss, element: toast };
}

export const notifySuccess = (message, options) =>
  notify(message, { ...options, type: "success" });

export const notifyError = (message, options) =>
  notify(message, { ...options, type: "error" });

export const notifyInfo = (message, options) =>
  notify(message, { ...options, type: "info" });

export const notifyWarning = (message, options) =>
  notify(message, { ...options, type: "warning" });
