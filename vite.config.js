import { defineConfig } from "vite";

export default defineConfig({
  base: "/stripe-eds-express-checkout/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    open: true,
    port: 8000,
  },
});
