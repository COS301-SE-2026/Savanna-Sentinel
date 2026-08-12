import { useMemo } from "react";

import { formatRole } from "@/lib/utils";

const ROLES = ["admin", "analyst", "ranger", "community liaison"];

export function useRoleOptions() {
    return useMemo(() => {
        return ROLES.map((role) => ({
            value: role,
            label: formatRole(role),
        }));
    }, []);
}
