export const ENVIRONMENTS = Object.freeze({
  saas: {
    label: "SaaS sandbox",
    commerceGraphqlUrl:
      "https://na1-sandbox.api.commerce.adobe.com/XjRnU4rfv1hG6ihVjmXJdi/graphql",
    appBuilderStripeActionBaseUrl:
      "https://890003-christostestappname-development.adobeioruntime.net/api/v1/web/stripe",
    productSku: "PSV-3003",
  },
  paas: {
    label: "PaaS development",
    commerceGraphqlUrl:
      "https://adobe-enterprise2.developmentcloud.net/graphql",
    appBuilderStripeActionBaseUrl:
      "https://890003-christostestappname-developmentpaas.adobeioruntime.net/api/v1/web/stripe",
    productSku: "24-MB04",
  },
});
