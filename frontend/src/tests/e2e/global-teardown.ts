import { execFileSync } from "child_process";

const FIXTURE_MARKER = "e2e-fixture/risk-v1";

export default async function globalTeardown() {
    console.log("[e2e] Cleaning up risk-heatmap fixture data...");
    try {
        execFileSync(
            "docker",
            [
                "compose",
                "exec",
                "-T",
                "db",
                "psql",
                "-U",
                "sentinel",
                "-d",
                "savanna_sentinel",
                "-v",
                "ON_ERROR_STOP=1",
                "-c",
                `DELETE FROM risk_heatmaps WHERE model_id IN (SELECT id FROM risk_models WHERE object_storage_key = '${FIXTURE_MARKER}'); ` +
                    `DELETE FROM risk_models WHERE object_storage_key = '${FIXTURE_MARKER}';`,
            ],
            { stdio: "inherit" },
        );
    } catch (e) {
        console.log(
            "[e2e] Fixture cleanup failed (DB may already be down):",
            e,
        );
    }
}
