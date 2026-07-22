import { test, expect } from "@playwright/test";
import { execSync } from "child_process";

test.describe("Registration Flow", () => {
    const workerId = process.env.TEST_WORKER_INDEX || "0";

    const deleteUserFromDb = (email: string, username: string) => {
        try {
            execSync(
                `docker compose exec -i db psql -U sentinel -d savanna_sentinel -c "DELETE FROM users WHERE email = '${email}' OR username = '${username}';"`,
                { stdio: "ignore" },
            );
        } catch (e) {
            console.log("DB container not ready or cleanup script failed: ", e);
        }
    };

    test("Empty registration fields test, should show error messages", async ({
        page,
    }) => {
        await page.goto("/register");

        const registerButton = page.getByRole("button", { name: /register/i });
        await registerButton.click();

        const requiredErrors = page.locator("p.text-red-300");

        await expect(requiredErrors).toHaveCount(6);
        await expect(requiredErrors).toHaveText([
            "First name is required",
            "Last name is required",
            "Username is required",
            "Enter a valid email address",
            "Password must be at least 8 characters",
            "Please select a role",
        ]);
    });
    test("Successful registration shows pending activation screen", async ({
        page,
    }) => {
        //Generate user details
        const testTimestamp = `${Date.now()}_1`;
        const testEmail = `automation_w${workerId}_${testTimestamp}@example.com`;
        const testUsername = `ranger_w${workerId}_${testTimestamp}`;

        //Before cleanup for safety
        deleteUserFromDb(testEmail, testUsername);

        await page.goto("/register");

        await page.getByLabel(/first name/i).fill("Automation");
        await page.getByLabel(/last name/i).fill("Test");
        await page.getByLabel(/username/i).fill(testUsername);
        await page.getByLabel(/email/i).fill(testEmail);
        await page
            .getByRole("textbox", { name: "Password" })
            .fill("SuperSecurePassword123!");
        await page.getByRole("combobox", { name: "Role" }).click();
        await page.getByRole("option", { name: "Ranger" }).click();
        await page.getByRole("button", { name: "Register" }).click();

        await expect(
            page.getByRole("heading", { name: "REQUEST SENT" }),
        ).toBeVisible();
        await expect(
            page.getByText(
                "Your account is pending admin activation. You will be able to log in once approved.",
            ),
        ).toBeVisible();
        await expect(
            page.getByRole("link", { name: /back to login/i }),
        ).toBeVisible();

        deleteUserFromDb(testEmail, testUsername);
    });
    test("Submitting existing email or username displays correct error banner", async ({
        page,
    }) => {
        const testTimestamp = `${Date.now()}_1`;
        const testEmail = `automation_w${workerId}_${testTimestamp}@example.com`;
        const testUsername = `ranger_w${workerId}_${testTimestamp}`;

        deleteUserFromDb(testEmail, testUsername);

        await page.goto("/register");

        //First registration
        await page.getByLabel(/first name/i).fill("Automation");
        await page.getByLabel(/last name/i).fill("Test");
        await page.getByLabel(/username/i).fill(testUsername);
        await page.getByLabel(/email/i).fill(testEmail);
        await page
            .getByRole("textbox", { name: "Password" })
            .fill("SuperSecurePassword123!");
        await page.getByRole("combobox", { name: "Role" }).click();
        await page.getByRole("option", { name: "Ranger" }).click();
        await page.getByRole("button", { name: "Register" }).click();
        await expect(
            page.getByRole("heading", { name: "REQUEST SENT" }),
        ).toBeVisible();

        //Second registration
        await page.goto("/register");

        await page.getByLabel(/first name/i).fill("Second");
        await page.getByLabel(/last name/i).fill("User");
        await page.getByLabel(/username/i).fill(testUsername);
        await page.getByLabel(/email/i).fill(testEmail);
        await page
            .getByRole("textbox", { name: "Password" })
            .fill("AnotherValidPassword123!");
        await page.getByRole("combobox", { name: "Role" }).click();
        await page.getByRole("option", { name: "Ranger" }).click();
        await page.getByRole("button", { name: "Register" }).click();

        const error = page.getByRole("alert");
        await expect(error).toBeVisible();
        await expect(error).toHaveText("Email or username is already in use.");

        deleteUserFromDb(testEmail, testUsername);
    });
});
