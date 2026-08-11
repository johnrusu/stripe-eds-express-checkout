const DEFAULT_DURATION_MS = 3200;

const TYPE_LABEL = Object.freeze({
  success: "Success",
  error: "Error",
  info: "Info",
  warning: "Warning",
});

const TYPE_BG = Object.freeze({
  success: "bg-emerald-700",
  error: "bg-red-700",
  info: "bg-blue-700",
  warning: "bg-amber-700",
});

const HOST_CLASS =
  "pointer-events-none fixed right-4 bottom-4 z-40 flex max-w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2.5 max-[700px]:inset-x-3 max-[700px]:bottom-3 max-[700px]:max-w-none";

const TOAST_BASE_CLASS =
  "pointer-events-auto grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 rounded-[10px] px-[0.9rem] py-[0.85rem] text-white opacity-0 shadow-[0_12px_30px_rgb(17_24_39_/_18%)] transition duration-[160ms] ease-out translate-y-2";

const ENTER_CLASSES = ["opacity-100", "translate-y-0"];
const LEAVE_CLASSES = ["opacity-0", "translate-y-1.5"];

let host = null;

function ensureHost() {
  if (host && document.body.contains(host)) {
    return host;
  }

  host = document.createElement("div");
  host.className = HOST_CLASS;
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
  toast.className = `${TOAST_BASE_CLASS} ${TYPE_BG[type]}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");

  const label = document.createElement("span");
  label.className =
    "text-[0.72rem] font-bold tracking-[0.04em] uppercase opacity-80";
  label.textContent = TYPE_LABEL[type];

  const body = document.createElement("p");
  body.className = "col-start-1 m-0 text-[0.92rem] leading-snug";
  body.textContent = text;

  const close = document.createElement("button");
  close.type = "button";
  close.className =
    "col-start-2 row-span-2 row-start-1 min-h-0 cursor-pointer self-start border-0 bg-transparent p-0 text-[1.1rem] leading-none font-bold text-inherit opacity-75 hover:bg-transparent hover:opacity-100";
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
    toast.classList.remove(...ENTER_CLASSES);
    toast.classList.add(...LEAVE_CLASSES);
    window.setTimeout(() => {
      toast.remove();
    }, 180);
  };

  close.addEventListener("click", dismiss);

  if (durationMs > 0) {
    window.setTimeout(dismiss, durationMs);
  }

  requestAnimationFrame(() => {
    toast.classList.remove("opacity-0", "translate-y-2");
    toast.classList.add(...ENTER_CLASSES);
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
