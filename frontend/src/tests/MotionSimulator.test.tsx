import {
    render,
    screen,
    fireEvent,
    act,
    cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MotionSimulator } from "@/components/dev/MotionSimulator";

if (typeof globalThis.DeviceMotionEvent === "undefined") {
    class MockDeviceMotionEvent extends Event {
        acceleration: unknown;
        accelerationIncludingGravity: unknown;
        rotationRate: unknown;
        interval: number;

        constructor(type: string, eventInitDict?: DeviceMotionEventInit) {
            super(type, eventInitDict);
            this.acceleration = eventInitDict?.acceleration;
            this.accelerationIncludingGravity =
                eventInitDict?.accelerationIncludingGravity;
            this.rotationRate = eventInitDict?.rotationRate;
            this.interval = eventInitDict?.interval ?? 0;
        }
    }

    vi.stubGlobal("DeviceMotionEvent", MockDeviceMotionEvent);
}

function renderPage() {
    return render(<MotionSimulator />);
}

describe("MotionSimulator", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("renders in disabled state by default", () => {
        renderPage();

        expect(screen.getByText("Accelerometer Simulator")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /off/i }),
        ).toBeInTheDocument();

        expect(
            screen.queryByRole("button", { name: /manual/i }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText("Rotation Rate (deg/s)"),
        ).not.toBeInTheDocument();
    });

    it("shows controls when enabled and hides them when disabled", async () => {
        renderPage();

        const toggleButton = screen.getByRole("button", { name: /off/i });
        fireEvent.click(toggleButton);

        expect(screen.getByRole("button", { name: /on/i })).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /manual/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /walking/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /shaking/i }),
        ).toBeInTheDocument();

        const onButton = screen.getByRole("button", { name: /on/i });
        fireEvent.click(onButton);

        expect(
            screen.getByRole("button", { name: /off/i }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /manual/i }),
        ).not.toBeInTheDocument();
    });

    it("sends a devicemotion event every 50ms when enabled", () => {
        const motionListener = vi.fn();
        window.addEventListener("devicemotion", motionListener);

        renderPage();

        const toggleButton = screen.getByRole("button", { name: /off/i });
        fireEvent.click(toggleButton);

        expect(motionListener).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(50);
        });

        expect(motionListener).toHaveBeenCalledTimes(1);

        const event = motionListener.mock.calls[0][0] as DeviceMotionEvent;
        expect(event.acceleration).toEqual({ x: 0, y: 0, z: 9.8 });
        expect(event.rotationRate).toEqual({ alpha: 0, beta: 0, gamma: 0 });

        act(() => {
            vi.advanceTimersByTime(100);
        });

        expect(motionListener).toHaveBeenCalledTimes(3);
        window.removeEventListener("devicemotion", motionListener);
    });

    it("stops sending events when turned off", () => {
        const motionListener = vi.fn();
        window.addEventListener("devicemotion", motionListener);

        renderPage();

        const toggleButton = screen.getByRole("button", { name: /off/i });
        fireEvent.click(toggleButton);

        act(() => {
            vi.advanceTimersByTime(50);
        });

        expect(motionListener).toHaveBeenCalledTimes(1);

        const onButton = screen.getByRole("button", { name: /on/i });
        fireEvent.click(onButton);

        act(() => {
            vi.advanceTimersByTime(100);
        });

        expect(motionListener).toHaveBeenCalledTimes(1);
        fireEvent.click(toggleButton);
        cleanup();

        act(() => {
            vi.advanceTimersByTime(200);
        });

        expect(motionListener).toHaveBeenCalledTimes(1);
        window.removeEventListener("devicemotion", motionListener);
    });

    it("hides sliders when switching to walking or shaking", () => {
        renderPage();

        const toggleButton = screen.getByRole("button", { name: /off/i });
        fireEvent.click(toggleButton);

        expect(screen.getByText("Rotation Rate (deg/s)")).toBeInTheDocument();

        const walkingButton = screen.getByRole("button", { name: /walking/i });
        fireEvent.click(walkingButton);
        expect(
            screen.queryByText("Rotation Rate (deg/s)"),
        ).not.toBeInTheDocument();

        const shakingButton = screen.getByRole("button", { name: /shaking/i });
        fireEvent.click(shakingButton);
        expect(
            screen.queryByText("Rotation Rate (deg/s)"),
        ).not.toBeInTheDocument();

        const manualButton = screen.getByRole("button", { name: /manual/i });
        fireEvent.click(manualButton);
        expect(screen.getByText("Rotation Rate (deg/s)")).toBeInTheDocument();
    });

    it("sends wave data when walking is select", () => {
        const motionListener = vi.fn();
        window.addEventListener("devicemotion", motionListener);

        renderPage();

        const toggleButton = screen.getByRole("button", { name: /off/i });
        fireEvent.click(toggleButton);
        const walkingButton = screen.getByRole("button", { name: /walking/i });
        fireEvent.click(walkingButton);

        act(() => {
            vi.advanceTimersByTime(50);
        });

        const event = motionListener.mock.calls[0][0] as DeviceMotionEvent;
        expect(event.acceleration?.x).toBeCloseTo(0.298, 2);

        window.removeEventListener("devicemotion", motionListener);
    });

    it("updates motion when sliders change", async () => {
        const motionListener = vi.fn();
        window.addEventListener("devicemotion", motionListener);

        renderPage();

        const toggleButton = screen.getByRole("button", { name: /off/i });
        fireEvent.click(toggleButton);

        const inputs = screen.getAllByRole("slider");
        const xSlider = inputs[0];

        fireEvent.change(xSlider, { target: { value: "25" } });

        act(() => {
            vi.advanceTimersByTime(50);
        });

        const event = motionListener.mock.calls[0][0] as DeviceMotionEvent;
        expect(event.acceleration?.x).toBeCloseTo(25, 2);

        window.removeEventListener("devicemotion", motionListener);
    });
});
