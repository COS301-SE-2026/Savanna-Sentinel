import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            strategies: "injectManifest",
            srcDir: "src",
            filename: "sw.ts",
            registerType: "prompt",
            injectRegister: null,
            manifest: {
                id: "/",
                name: "Savanna Sentinel",
                short_name: "Sentinel",
                description:
                    "Wildlife conservation monitoring for rangers, analysts and community liaisons",
                start_url: "/",
                scope: "/",
                display: "standalone",
                lang: "en",
                background_color: "#F2F2F2",
                theme_color: "#003A6B",
                icons: [
                    {
                        src: "/pwa-64x64.png",
                        sizes: "64x64",
                        type: "image/png",
                    },
                    {
                        src: "/pwa-192x192.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "/pwa-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                    },
                    {
                        src: "/maskable-icon-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable",
                    },
                ],
            },
            injectManifest: {
                globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
                globIgnores: ["logo.png"],
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            },
            devOptions: {
                enabled: false,
                type: "module",
            },
        }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: "./src/tests/setup.ts",
        exclude: [
            ...configDefaults.exclude,
            "src/tests/e2e/**/*",
            "src/tests/NFR/**/*",
        ],
    },
    build: {
        outDir: "web-build",
    },
});
