import { test, expect } from "@playwright/test"
import { execSync } from "child_process"

test.describe("Registration Flow", () => {
    const testEmail = "testuser_automation_123@example.com";
    test.beforeAll(async () => {
        try{
            execSync(`docker compose exec -i db psql -U sentinel -d savanna_sentinel -c "DELETE FROM users WHERE email = '${testEmail}';"`, {stdio: "ignore"})
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        catch(e){
            console.log("DB container not ready, not running cleanup script")
        }
    })
    test.afterAll(async () => {
        try{
            execSync(`docker compose exec -i db psql -U sentinel -d savanna_sentinel -c "DELETE FROM users WHERE email = '${testEmail}';"`, {stdio: "ignore"})
            console.log("DB cleanup script succeeded.")
        }
        catch(e){
            console.error("DB cleanup script failed to execute, cleanup script will attempt to run on next cleanup: ", e)
        }
    })

    test("Empty registration fields test, should show error messages", async ({page}) => {
        await page.goto("/register")

        const registerButton = page.getByRole("button", {name: /register/i});
        await registerButton.click();

        const requiredErrors = page.locator("p.text-red-300");

        await expect(requiredErrors).toHaveCount(6);
        await expect(requiredErrors).toHaveText([
            "First name is required",
            "Last name is required",
            "Username is required",
            "Enter a valid email address",
            "Password must be at least 8 characters",
            "Please select a role"
        ])
    })
})