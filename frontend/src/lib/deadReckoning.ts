export const STEP_LENGTH_M = 0.7;

const STEP_THRESHOLD = 1.0;
const MIN_STEP_INTERVAL_S = 0.3;
const MAX_SAMPLE_GAP_S = 0.5;
const GRAVITY_TAU_S = 2;
const SIGNAL_TAU_S = 0.08;

interface Vector3 {
    x: number | null;
    y: number | null;
    z: number | null;
}

export function vectorMagnitude(v: Vector3 | null | undefined): number | null {
    if (!v || v.x === null || v.y === null || v.z === null) return null;
    return Math.hypot(v.x, v.y, v.z);
}

interface StepDetector {
    push: (magnitude: number, timeS: number) => boolean;
}

export function createStepDetector(): StepDetector {
    let baseline = 0;
    let signal = 0;
    let isArmed = true;
    let lastSample: number | null = null;
    let lastStep = -Infinity;

    return {
        push(magnitude, timeS) {
            if (lastSample === null || timeS - lastSample > MAX_SAMPLE_GAP_S) {
                lastSample = timeS;
                baseline = magnitude;
                signal = 0;
                isArmed = true;
                return false;
            }

            const dt = timeS - lastSample;
            if (dt <= 0) return false;
            lastSample = timeS;

            baseline +=
                (magnitude - baseline) * (1 - Math.exp(-dt / GRAVITY_TAU_S));
            signal +=
                (magnitude - baseline - signal) *
                (1 - Math.exp(-dt / SIGNAL_TAU_S));

            if (signal < 0) {
                isArmed = true;
                return false;
            }
            if (
                isArmed &&
                signal > STEP_THRESHOLD &&
                timeS - lastStep >= MIN_STEP_INTERVAL_S
            ) {
                isArmed = false;
                lastStep = timeS;
                return true;
            }
            return false;
        },
    };
}

function normalise(deg: number) {
    return ((deg % 360) + 360) % 360;
}

export function headingFromOrientation(
    alpha: number,
    beta: number,
    gamma: number,
    screenAngle = 0,
): number | null {
    const rad = Math.PI / 180;
    const cX = Math.cos(beta * rad);
    const sX = Math.sin(beta * rad);
    const cY = Math.cos(gamma * rad);
    const sY = Math.sin(gamma * rad);
    const cZ = Math.cos(alpha * rad);
    const sZ = Math.sin(alpha * rad);

    const upX = Math.sin(screenAngle * rad);
    const upY = Math.cos(screenAngle * rad);

    const upEast = (cZ * cY - sZ * sX * sY) * upX - cX * sZ * upY;
    const upNorth = (cY * sZ + cZ * sX * sY) * upX + cZ * cX * upY;
    const camEast = -(cY * sZ * sX + cZ * sY);
    const camNorth = -(sZ * sY - cZ * cY * sX);

    const camWeight = 1 - Math.min(Math.hypot(upEast, upNorth), 1);
    const east = upEast + camWeight * camEast;
    const north = upNorth + camWeight * camNorth;

    if (Math.hypot(east, north) < 1e-6) return null;
    return normalise(Math.atan2(east, north) / rad);
}

type CompassEvent = Pick<
    DeviceOrientationEvent,
    "alpha" | "beta" | "gamma" | "absolute" | "type"
> & { webkitCompassHeading?: number };

export function compassFromEvent(
    event: CompassEvent,
    screenAngle = 0,
): number | null {
    let alpha: number | null;
    if (
        typeof event.webkitCompassHeading === "number" &&
        event.webkitCompassHeading >= 0
    ) {
        alpha = 360 - event.webkitCompassHeading;
    } else if (event.absolute || event.type === "deviceorientationabsolute") {
        alpha = event.alpha;
    } else {
        return null;
    }
    if (alpha === null) return null;

    return headingFromOrientation(
        alpha,
        event.beta ?? 0,
        event.gamma ?? 0,
        screenAngle,
    );
}

export function headingDifference(a: number, b: number) {
    return Math.abs(((b - a + 540) % 360) - 180);
}

export function blendHeading(prev: number, next: number, weight: number) {
    const diff = ((next - prev + 540) % 360) - 180;
    return normalise(prev + diff * weight);
}
