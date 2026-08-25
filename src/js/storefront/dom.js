import { SELECTOR } from "../constants.js";

export const dom = {
  addProductButton: document.querySelector(SELECTOR.addProductButton),
  blocker: document.querySelector(SELECTOR.blocker),
  cartForm: document.querySelector(SELECTOR.cartForm),
  cartId: document.querySelector(SELECTOR.cartId),
  cartStatus: document.querySelector(SELECTOR.cartStatus),
  clearLogButton: document.querySelector(SELECTOR.clearLogButton),
  copyLogButton: document.querySelector(SELECTOR.copyLogButton),
  clearSessionButton: document.querySelector(SELECTOR.clearSessionButton),
  commerceUrl: document.querySelector(SELECTOR.commerceUrl),
  configurationForm: document.querySelector(SELECTOR.configurationForm),
  connectionStatus: document.querySelector(SELECTOR.connectionStatus),
  createCartButton: document.querySelector(SELECTOR.createCartButton),
  customerToken: document.querySelector(SELECTOR.customerToken),
  environmentPreset: document.querySelector(SELECTOR.environmentPreset),
  expressCheckoutSection: document.querySelector(
    SELECTOR.expressCheckoutSection
  ),
  log: document.querySelector(SELECTOR.log),
  paymentContent: document.querySelector(SELECTOR.paymentContent),
  paymentStatus: document.querySelector(SELECTOR.paymentStatus),
  orderSuccess: document.querySelector(SELECTOR.orderSuccess),
  orderSuccessMessage: document.querySelector(SELECTOR.orderSuccessMessage),
  orderSuccessTitle: document.querySelector(SELECTOR.orderSuccessTitle),
  startOverButton: document.querySelector(SELECTOR.startOverButton),
  productQuantity: document.querySelector(SELECTOR.productQuantity),
  productSku: document.querySelector(SELECTOR.productSku),
  runtimeBaseUrl: document.querySelector(SELECTOR.runtimeBaseUrl),
  storeCode: document.querySelector(SELECTOR.storeCode),
  summaryCapture: document.querySelector(SELECTOR.summaryCapture),
  summaryCustomer: document.querySelector(SELECTOR.summaryCustomer),
  summaryShippingAddress: document.querySelector(
    SELECTOR.summaryShippingAddress
  ),
  summaryShippingMethod: document.querySelector(SELECTOR.summaryShippingMethod),
  summaryStripe: document.querySelector(SELECTOR.summaryStripe),
  summaryTotal: document.querySelector(SELECTOR.summaryTotal),
  wallet: document.querySelector(SELECTOR.wallet),
  purgeLocalStorageButton: document.querySelector(
    SELECTOR.purgeLocalStorageButton
  ),
};
