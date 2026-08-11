# Stripe Express Checkout storefront

Standalone one-page storefront for **Adobe Commerce** and **Stripe Express Checkout**. It is for merchants and engineers who need the same Confirmation Token / Express Checkout Element (ECE) lifecycle as the EDS block, without installing Edge Delivery Services.

The browser orchestrates checkout. App Builder and Commerce remain the authority for PaymentIntent amount, currency, customer, capture mode, and idempotency. The storefront does **not** call `stripe.createPaymentMethod()`.

**Live demo:** [johnrusu.github.io/stripe-eds-express-checkout](https://johnrusu.github.io/stripe-eds-express-checkout/)

## What it does

1. Connect to Adobe Commerce GraphQL (optional customer bearer token).
2. Create or load a cart, add a product by SKU.
3. Discover Stripe OOPE / App Builder runtime URLs from the cart (or use a base URL override).
4. Mount Stripe Express Checkout Element from App Builder `init-params`.
5. Collect wallet details, sync shipping to Commerce, create a Confirmation Token, call App Builder `payment-intent`, confirm in Stripe.js, then place the Commerce order.

Built-in **SaaS** and **PaaS** environment presets fill Commerce URL, App Builder base URL, and a sample SKU. A live checkout log records connect, cart, wallet, payment, and order events.

## Stack

| Piece | Choice |
| --- | --- |
| Bundler / dev server | Vite 8 |
| UI | HTML + Tailwind CSS 4 |
| Scripts | Vanilla ES modules (`src/js/`) |
| Deploy | GitHub Pages (`dist/` via Actions) |

## Project layout

```text
index.html                 # Storefront UI
public/favicon.svg
src/
  css/storefront.css       # Tailwind entry + theme tokens
  js/
    storefront.js          # ECE + Commerce orchestration
    environments.js        # SaaS / PaaS presets
    notifications.js       # Toast notifications
    index.js               # Local form persistence helpers
    utils.js
scripts/commit.sh
.github/workflows/deploy-pages.yml
```

## Setup

```sh
npm install
npm start
```

Opens the Vite dev server (default port `8000`).

Useful scripts:

```sh
npm run build      # production build → dist/
npm run preview    # preview the production build
npm run lint
npm run format
```

## Local testing notes

- Use **Stripe test mode** and a disposable Commerce cart. A successful wallet confirmation places a real Commerce order.
- Cross-origin GraphQL calls often require Chrome with web security disabled in a **dedicated** profile (not your everyday browser session):

**Windows**

```bat
chrome.exe --user-data-dir="C:\Chrome dev session" --disable-web-security
```

**macOS**

```sh
open -n -a /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --args --user-data-dir="/tmp/chrome_dev_test" --disable-web-security
```

Wallet buttons also depend on HTTPS (or localhost), wallet enrollment on the device/browser, and payment-method domain registration in the Stripe Dashboard.

## Checkout contract

| Step | Behavior |
| --- | --- |
| Init | `GET` App Builder `init-params` → deferred Elements / ECE |
| Confirm | `createConfirmationToken()` → App Builder `payment-intent` → `confirmPayment({ confirmation_token })` → Commerce `placeOrder` |
| Shipping | Commerce owns rates; complete wallet addresses are persisted; redacted addresses are used for estimates |
| Failures | ECE `loaderror` is logged and the wallet UI is hidden; payment failures appear in the on-page log |
| UX | Checkout is blocked from wallet `click` until `cancel`, `escape`, or completion |

## Manual acceptance checks

Against your target Commerce + App Builder environment:

1. Guest cart with no email/address/method; select a wallet address and rate; paid amount matches the refreshed Commerce cart total.
2. Registered customer with default shipping/billing and a selected rate; wallet does not recollect shipping.
3. Change wallet shipping address and rate; both are on the cart before `payment-intent` is called.
4. Repeat with automatic and manual capture. For manual capture, PaymentIntent reaches `requires_capture`.
5. Cancel / escape from the wallet and confirm the blocker is removed. Force an ECE load error and confirm the wallet section stays hidden.

## License

Private project (`package.json`).
