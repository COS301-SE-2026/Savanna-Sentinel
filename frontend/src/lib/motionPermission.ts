interface PermissionGate {
    requestPermission?: () => Promise<string>;
}

export async function requestMotionPermission(): Promise<boolean> {
    const gates = [
        globalThis.DeviceMotionEvent,
        globalThis.DeviceOrientationEvent,
    ] as unknown as (PermissionGate | undefined)[];

    const requests: Promise<string>[] = [];
    for (const gate of gates) {
        if (typeof gate?.requestPermission === "function") {
            requests.push(gate.requestPermission());
        }
    }

    const results = await Promise.all(requests);
    return results.every((result) => result === "granted");
}
