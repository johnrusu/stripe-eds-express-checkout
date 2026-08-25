import { CLIPBOARD, HTML_ELEMENT, TEXT } from "../constants.js";

export async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement(HTML_ELEMENT.TEXTAREA);
  textarea.value = text;
  textarea.setAttribute(CLIPBOARD.READONLY, "");
  textarea.style.position = CLIPBOARD.POSITION;
  textarea.style.left = CLIPBOARD.LEFT;
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (!document.execCommand(CLIPBOARD.EXEC_COMMAND)) {
      throw new Error(TEXT.copyCommandFailed);
    }
  } finally {
    textarea.remove();
  }
}
