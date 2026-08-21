import { registerSW } from "virtual:pwa-register";
import { toast as sonnerToast } from "sonner";

import { UpdateToast } from "@/offline/UpdateToast";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    const updateSW = registerSW({
        onNeedRefresh() {
            sonnerToast.custom(
                (id) => (
                    <UpdateToast id={id} onReload={() => void updateSW(true)} />
                ),
                { duration: Infinity },
            );
        },
        onRegisteredSW(_swUrl, registration) {
            if (!registration) return;
            setInterval(() => {
                void registration.update();
            }, UPDATE_CHECK_INTERVAL_MS);
        },
    });
}
