# Express Checkout reference implementations

This directory contains two frontend-only integrations for Adobe Commerce and
the existing Stripe App Builder actions:

- `blocks/stripe-express-checkout/` is the EDS checkout block.
- `storefront.html`, `storefront.js`, and `storefront.css` are a standalone
  one-page storefront for merchants who do not use EDS.

Both implementations use Stripe Express Checkout Element and Confirmation
Tokens. Neither uses `stripe.createPaymentMethod()`. The backend remains the
authority for PaymentIntent amount, currency, customer, capture mode, and
idempotency.

## Requirement coverage

| Requirement | Implementation                                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1           | Reads the current `init-params` endpoint and initializes deferred Elements/ECE.                                                   |
| 2           | Calls the current `payment-intent` endpoint, confirms in Stripe.js, then places the Commerce order.                               |
| 3           | Uses `createConfirmationToken()` and passes `confirmation_token` to `confirmPayment()`.                                           |
| 4           | Omits wallet shipping collection and remounts ECE after Commerce has a complete address and selected rate.                        |
| 5           | Persists complete wallet addresses, estimates from redacted addresses, displays Commerce rates, and persists wallet rate changes. |
| 6           | Logs ECE `loaderror` with `console.warn()` and hides the wallet section.                                                          |
| 7           | Blocks checkout interaction from wallet `click` until `cancel`, `escape`, or completion.                                          |
| 8           | Automated tests cover guest checkout and registered checkout with default addresses, including automatic and manual capture.      |
| 9           | Intentionally excluded by the feature requirements.                                                                               |
| 10          | The block installation guide is in `blocks/stripe-express-checkout/README.md`.                                                    |
| 11          | The standalone one-page storefront implements the same ECE/Confirmation Token lifecycle.                                          |

## Automated verification

Run the focused suite from the repository root:

```sh
npx jest --runInBand \
  test/actions/init-params.test.js \
  test/eds-token/stripe-express-checkout.test.js \
  test/eds-token/standalone-storefront.test.js
```

The tests validate guest and authenticated requests, complete and redacted
shipping-address handling, shipping-rate persistence, ECE remounting, loader
cleanup, silent load failure, automatic capture, manual capture, Confirmation
Token creation, frontend PaymentIntent confirmation, and order placement.

## Live acceptance checks

Wallet availability depends on HTTPS, browser/device wallet enrollment, Stripe
test-mode configuration, and payment-method domain registration. Before release,
run these cases against the target Commerce and App Builder environment:

1. Guest cart with no email/address/method; select a wallet address and rate and
   verify the paid amount equals the refreshed Commerce cart total.
2. Registered customer with default shipping/billing address and selected rate;
   verify the wallet does not recollect shipping.
3. Change the wallet shipping address and rate; verify both are present on the
   cart before `payment-intent` is called.
4. Repeat cases 1–3 with automatic and manual capture configurations. For
   manual capture, verify the PaymentIntent reaches `requires_capture` and the
   existing invoice lifecycle performs capture.
5. Cancel and escape from the wallet and verify the blocker is removed. Force a
   Stripe.js load error and verify only a console warning is emitted while the
   ECE UI stays hidden.

Use test-mode wallets and disposable carts: a successful confirmation places a
real Adobe Commerce order in the configured environment.
