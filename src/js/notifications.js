import { DOM_EVENT, HTML_ATTR, HTML_ELEMENT, NOTIFICATION } from "./constants.js";

let host = null;

function ensureHost() {
  if (host && document.body.contains(host)) {
    return host;
  }

  host = document.createElement(HTML_ELEMENT.DIV);
  host.className = NOTIFICATION.HOST_CLASS;
  host.setAttribute(NOTIFICATION.ARIA_LIVE, NOTIFICATION.ARIA_LIVE_POLITE);
  host.setAttribute(
    NOTIFICATION.ARIA_RELEVANT,
    NOTIFICATION.ARIA_RELEVANT_ADDITIONS
  );
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

  const type = NOTIFICATION.TYPE_LABEL[options.type]
    ? options.type
    : NOTIFICATION.TYPE.INFO;
  const durationMs =
    Number.isFinite(options.durationMs) && options.durationMs >= 0
      ? options.durationMs
      : NOTIFICATION.DEFAULT_DURATION_MS;

  const toast = document.createElement(HTML_ELEMENT.DIV);
  toast.className = `${NOTIFICATION.TOAST_BASE_CLASS} ${NOTIFICATION.TYPE_BG[type]}`;
  toast.setAttribute(
    HTML_ATTR.ROLE,
    type === NOTIFICATION.TYPE.ERROR
      ? NOTIFICATION.ROLE_ALERT
      : NOTIFICATION.ROLE_STATUS
  );

  const label = document.createElement(HTML_ELEMENT.SPAN);
  label.className = NOTIFICATION.LABEL_CLASS;
  label.textContent = NOTIFICATION.TYPE_LABEL[type];

  const body = document.createElement(HTML_ELEMENT.PARAGRAPH);
  body.className = NOTIFICATION.BODY_CLASS;
  body.textContent = text;

  const close = document.createElement(HTML_ELEMENT.BUTTON);
  close.type = NOTIFICATION.BUTTON;
  close.className = NOTIFICATION.CLOSE_CLASS;
  close.setAttribute(HTML_ATTR.ARIA_LABEL, NOTIFICATION.CLOSE_LABEL);
  close.textContent = NOTIFICATION.CLOSE_SYMBOL;

  toast.append(label, body, close);
  ensureHost().appendChild(toast);

  let removed = false;
  const dismiss = () => {
    if (removed) {
      return;
    }
    removed = true;
    toast.classList.remove(...NOTIFICATION.ENTER_CLASSES);
    toast.classList.add(...NOTIFICATION.LEAVE_CLASSES);
    window.setTimeout(() => {
      toast.remove();
    }, NOTIFICATION.DISMISS_ANIMATION_MS);
  };

  close.addEventListener(DOM_EVENT.CLICK, dismiss);

  if (durationMs > 0) {
    window.setTimeout(dismiss, durationMs);
  }

  requestAnimationFrame(() => {
    toast.classList.remove(...NOTIFICATION.INITIAL_HIDDEN_CLASSES);
    toast.classList.add(...NOTIFICATION.ENTER_CLASSES);
  });

  return { dismiss, element: toast };
}

export const notifySuccess = (message, options) =>
  notify(message, { ...options, type: NOTIFICATION.TYPE.SUCCESS });

export const notifyError = (message, options) =>
  notify(message, { ...options, type: NOTIFICATION.TYPE.ERROR });

export const notifyInfo = (message, options) =>
  notify(message, { ...options, type: NOTIFICATION.TYPE.INFO });

export const notifyWarning = (message, options) =>
  notify(message, { ...options, type: NOTIFICATION.TYPE.WARNING });
