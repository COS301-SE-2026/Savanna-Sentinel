import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";

const PSQL_ARGS = [
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
];

function psqlQuery(sql: string): string {
    return execFileSync("docker", [...PSQL_ARGS, "-tAc", sql], {
        encoding: "utf-8",
    }).trim();
}

// Seeds risk data for the e2e tests (see fixtures/)
export default async function globalSetup() {
    const hasActiveModel =
        psqlQuery(
            "SELECT EXISTS(SELECT 1 FROM risk_models WHERE park_id = 'klaserie' AND is_active)",
        ) === "t";

    if (hasActiveModel) {
        console.log(
            "[e2e] Active risk model already exists - skipping fixture.",
        );
        return;
    }

    console.log("[e2e] Seeding risk-heatmap fixture data...");
    const fixtureSql = readFileSync(
        path.join(import.meta.dirname, "fixtures", "risk-heatmap-fixture.sql"),
        "utf-8",
    );
    execFileSync("docker", PSQL_ARGS, {
        input: fixtureSql,
        stdio: ["pipe", "inherit", "inherit"],
    });
}
