import {
    defineConfig,
    minimal2023Preset,
} from "@vite-pwa/assets-generator/config";

const background = "#F2F2F2";

export default defineConfig({
    headLinkOptions: { preset: "2023" },
    preset: {
        ...minimal2023Preset,
        transparent: {
            sizes: [64, 192, 512],
            favicons: [[48, "favicon.ico"]],
            padding: 0.08,
            resizeOptions: { background, fit: "contain" },
        },
        maskable: {
            sizes: [512],
            padding: 0.3,
            resizeOptions: { background, fit: "contain" },
        },
        apple: {
            sizes: [180],
            padding: 0.1,
            resizeOptions: { background, fit: "contain" },
        },
    },
    images: ["public/logo.png"],
});
