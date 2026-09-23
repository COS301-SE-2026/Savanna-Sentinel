import { useState, useEffect } from "react";

interface MotionAxes {
    x: number;
    y: number;
    z: number;
}

interface RotationAxes {
    alpha: number;
    beta: number;
    gamma: number;
}

export function MotionSimulator() {
    const [isEnabled, setIsEnabled] = useState(false);
    const [motion, setMotion] = useState<MotionAxes>({
        x: 0,
        y: 0,
        //gravity
        z: 9.8,
    });
    const [rotation, setRotation] = useState<RotationAxes>({
        alpha: 0,
        beta: 0,
        gamma: 0,
    });
    const [preset, setPreset] = useState<"manual" | "walking" | "shaking">(
        "manual",
    );

    useEffect(() => {
        if (!isEnabled) {
            return;
        }

        let step = 0;
        const interval = setInterval(() => {
            let { x, y, z } = motion;
            let rot = { ...rotation };

            if (preset === "walking") {
                step += 0.2;
                x = Math.sin(step) * 1.5;
                y = Math.cos(step) * 2.5;
                z = 9.8 + Math.sin(step * 2) * 1.2;
                rot = { alpha: x * 2, beta: y * 2, gamma: z * 2 };
            } else if (preset === "shaking") {
                x = (Math.random() - 0.5) * 25;
                y = (Math.random() - 0.5) * 25;
                z = (Math.random() - 0.5) * 25;
                rot = {
                    alpha: (Math.random() - 0.5) * 50,
                    beta: (Math.random() - 0.5) * 50,
                    gamma: (Math.random() - 0.5) * 50,
                };
            }

            const deviceMotionEvent = new DeviceMotionEvent("devicemotion", {
                acceleration: { x, y, z },
                accelerationIncludingGravity: { x, y, z },
                rotationRate: rot,
                interval: 50,
            });

            window.dispatchEvent(deviceMotionEvent);
        }, 50);

        return () => clearInterval(interval);
    }, [isEnabled, motion, preset, rotation]);

    return (
        <div>
            <div>
                <span>Accelerometer Simulator</span>
                <button
                    onClick={() => setIsEnabled(!isEnabled)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                        isEnabled
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-700 text-slate-400"
                    }`}
                >
                    {isEnabled ? "ON" : "OFF"}
                </button>
            </div>

            {isEnabled && (
                <div>
                    <div className="grid grid-cols-3 gap-1">
                        {(["manual", "walking", "shaking"] as const).map(
                            (mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setPreset(mode)}
                                    className={`py-1 rounded text-[11px] capitalize transition-colors bg-blue-600 text-white`}
                                >
                                    {mode}
                                </button>
                            ),
                        )}
                    </div>

                    {preset === "manual" && (
                        <div>
                            {(["x", "y", "z"] as const).map((axis) => (
                                <div
                                    key={axis}
                                    className="flex items-center gap-2"
                                >
                                    <span>{axis}</span>
                                    <input
                                        type="range"
                                        min="-180"
                                        max="180"
                                        step="1"
                                        value={[axis]}
                                        onChange={(e) =>
                                            setMotion({
                                                ...motion,
                                                [axis]: Number.parseFloat(
                                                    e.target.value,
                                                ),
                                            })
                                        }
                                    />
                                    <span>{motion[axis].toFixed(1)}</span>
                                </div>
                            ))}
                            <div>Rotation Rate (deg/s)</div>
                            {(["alpha", "beta", "gamma"] as const).map(
                                (axis) => (
                                    <div
                                        key={axis}
                                        className="flex items-center gap-2"
                                    >
                                        <span>{axis}</span>
                                        <input
                                            type="range"
                                            min="-20"
                                            max="20"
                                            step="0.2"
                                            value={rotation[axis]}
                                            onChange={(e) =>
                                                setRotation({
                                                    ...rotation,
                                                    [axis]: Number.parseFloat(
                                                        e.target.value,
                                                    ),
                                                })
                                            }
                                        />
                                        <span>{rotation[axis]}</span>
                                    </div>
                                ),
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
