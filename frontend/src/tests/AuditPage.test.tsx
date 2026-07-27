import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditApi, type AuditLogResponse } from "@/services/auditApi";
import AuditLog from "@/components/admin/AuditLog";

vi.mock("@/services/auditApi", () => ({
    auditApi: {
        getLogs: vi.fn(),
    },
}));

const createMockResponse = (
    page = 1,
    total = 45,
    pageSize = 20,
): AuditLogResponse => ({
    total,
    page,
    page_size: pageSize,
    results: Array.from(
        {
            length: Math.min(
                pageSize,
                Math.max(0, total - (page - 1) * pageSize),
            ),
        },
        (_, i) => {
            const idNum = (page - 1) * pageSize + i + 1;
            return {
                id: `log-${idNum}`,
                actor_id: `actor-${idNum}`,
                action: `ACTION_${idNum}`,
                target_type: "user",
                target_id: `target-${idNum}`,
                details: idNum === 1 ? { new_role: "ranger" } : null,
                created_at: "2026-07-27T10:00:00Z",
            };
        },
    ),
});

