import { describe, it, expect } from "vitest";

import { getRiskLevel, getRiskCoverageColorClass } from "@/lib/mapTokens";

describe("getRiskLevel", () => {
    it("classifies scores below 0.25 as safe", () => {
        expect(getRiskLevel(0)).toBe("safe");
        expect(getRiskLevel(0.24)).toBe("safe");
    });

    it("classifies 0.25 up to (not including) 0.5 as caution", () => {
        expect(getRiskLevel(0.25)).toBe("caution");
        expect(getRiskLevel(0.49)).toBe("caution");
    });

    it("classifies 0.5 up to (not including) 0.75 as alert", () => {
        expect(getRiskLevel(0.5)).toBe("alert");
        expect(getRiskLevel(0.74)).toBe("alert");
    });

    it("classifies 0.75 and above as critical", () => {
        expect(getRiskLevel(0.75)).toBe("critical");
        expect(getRiskLevel(1)).toBe("critical");
    });
});

describe("getRiskCoverageColorClass", () => {
    it("returns the critical class below 40%", () => {
        expect(getRiskCoverageColorClass(39)).toBe("text-status-critical-text");
    });

    it("returns the caution class from 40% to 70% inclusive", () => {
        expect(getRiskCoverageColorClass(40)).toBe("text-status-caution-text");
        expect(getRiskCoverageColorClass(70)).toBe("text-status-caution-text");
    });

    it("returns the safe class above 70%", () => {
        expect(getRiskCoverageColorClass(71)).toBe("text-status-safe-text");
    });
});
