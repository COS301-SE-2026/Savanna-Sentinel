import { describe, it, expect, vi } from "vitest";
import { api } from "@/services/api";
import { auditApi } from "@/services/auditApi";

vi.mock("@/services/api", () => ({
    api: { get: vi.fn() },
}));

describe("auditApi.exportCsv", () => {
    it("requests the export endpoint as a blob", async () => {
        const mockBlob = new Blob(["id,action\n1,test"], { type: "text/csv" });
        vi.mocked(api.get).mockResolvedValueOnce({ data: mockBlob });

        const result = await auditApi.exportCsv();

        expect(api.get).toHaveBeenCalledWith("/audit-logs/export", {
            responseType: "blob",
        });
        expect(result).toBe(mockBlob);
    });
});
