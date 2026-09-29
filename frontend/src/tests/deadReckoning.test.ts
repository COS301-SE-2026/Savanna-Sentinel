import { describe, it, expect } from "vitest";

import {
    blendHeading,
    compassFromEvent,
    createStepDetector,
    headingDifference,
    headingFromOrientation,
    vectorMagnitude,
} from "@/lib/deadReckoning";

describe("headingFromOrientation", () => {
    it("points north when flat with the top facing north", () => {
        expect(headingFromOrientation(0, 0, 0)).toBeCloseTo(0);
    });

    it("turns the opposite way to alpha", () => {
        expect(headingFromOrientation(90, 0, 0)).toBeCloseTo(270);
        expect(headingFromOrientation(270, 0, 0)).toBeCloseTo(90);
    });

    it("gives the same heading however far the phone is tilted up", () => {
        for (const beta of [0, 30, 60, 90]) {
            expect(headingFromOrientation(270, beta, 0)).toBeCloseTo(90);
        }
    });

    it("uses where the camera points when held upright", () => {
        expect(headingFromOrientation(0, 90, 0)).toBeCloseTo(0);
    });

    it("accounts for landscape screen rotation", () => {
        expect(headingFromOrientation(0, 0, 0, 90)).toBeCloseTo(90);
        expect(headingFromOrientation(0, 0, 0, 270)).toBeCloseTo(270);
    });

    it("barely moves when the phone rolls sideways", () => {
        const heading = headingFromOrientation(0, 20, 30)!;
        expect(headingDifference(heading, 0)).toBeLessThan(5);
    });

    it("turns with the phone when upright", () => {
        expect(headingFromOrientation(0, 90, 30)).toBeCloseTo(330);
    });
});

describe("compassFromEvent", () => {
    it("uses Safari's compass heading", () => {
        expect(
            compassFromEvent({
                type: "deviceorientation",
                alpha: 12,
                beta: 0,
                gamma: 0,
                absolute: false,
                webkitCompassHeading: 45,
            }),
        ).toBeCloseTo(45);
    });

    it("skips Safari's -1 while the compass is uncalibrated", () => {
        expect(
            compassFromEvent({
                type: "deviceorientation",
                alpha: 12,
                beta: 0,
                gamma: 0,
                absolute: false,
                webkitCompassHeading: -1,
            }),
        ).toBeNull();
    });

    it("uses alpha from the absolute event on Android", () => {
        expect(
            compassFromEvent({
                type: "deviceorientationabsolute",
                alpha: 270,
                beta: 0,
                gamma: 0,
                absolute: false,
            }),
        ).toBeCloseTo(90);
    });

    it("rejects relative orientation", () => {
        expect(
            compassFromEvent({
                type: "deviceorientation",
                alpha: 270,
                beta: 0,
                gamma: 0,
                absolute: false,
            }),
        ).toBeNull();
    });
});

describe("createStepDetector", () => {
    const stride = [
        ...Array<number>(5).fill(9.81),
        ...Array<number>(5).fill(12.5),
        ...Array<number>(5).fill(7.2),
        ...Array<number>(5).fill(9.81),
    ];

    function countSteps(samples: number[], dt: number) {
        const detector = createStepDetector();
        let t = 0;
        let steps = 0;
        for (const magnitude of samples) {
            t += dt;
            if (detector.push(magnitude, t)) steps++;
        }
        return steps;
    }

    it("counts one step per stride", () => {
        const walk = Array.from({ length: 10 }, () => stride).flat();
        expect(countSteps(walk, 0.02)).toBe(10);
    });

    it("ignores jitter around gravity", () => {
        const jitter = Array.from({ length: 300 }, (_, i) =>
            i % 2 ? 10.2 : 9.4,
        );
        expect(countSteps(jitter, 0.016)).toBe(0);
    });

    it("works without gravity in the reading", () => {
        const linearStride = stride.map((m) => Math.abs(m - 9.81));
        const walk = Array.from({ length: 10 }, () => linearStride).flat();
        expect(countSteps(walk, 0.02)).toBeGreaterThanOrEqual(8);
    });

    it("won't count strides faster than a person can take them", () => {
        const frantic = Array.from({ length: 20 }, () => [
            9.81, 14, 14, 5, 5,
        ]).flat();
        expect(countSteps(frantic, 0.02)).toBeLessThanOrEqual(7);
    });
});

describe("heading helpers", () => {
    it("blends the short way round north", () => {
        expect(blendHeading(350, 10, 0.5)).toBeCloseTo(0);
    });

    it("measures the smaller angle between headings", () => {
        expect(headingDifference(350, 10)).toBeCloseTo(20);
        expect(headingDifference(90, 270)).toBeCloseTo(180);
    });

    it("returns null for a missing axis", () => {
        expect(vectorMagnitude({ x: 1, y: null, z: 1 })).toBeNull();
        expect(vectorMagnitude({ x: 3, y: 4, z: 0 })).toBe(5);
    });
});
