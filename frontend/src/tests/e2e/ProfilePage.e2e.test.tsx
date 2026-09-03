//THESE TESTS SHOULD ONLY BE RUN WITH 1 WORKER, ELSE RACE CONDITIONS MIGHT OCCUR
import { test, expect } from "@playwright/test";
import { execSync } from "child_process";

const generateUser = () => {
    const seed = Math.random().toString(36).substring(2, 7);
    return {
        username: `user_${seed}`,
        email: `test_${seed}@email.com`,
        password: "SuperSecretPassword123!",
        first_name: "Test",
        last_name: "Subject",
        requested_role: "ranger",
    };
};

const BASE_API_URL = "http://localhost:8000";

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
const activateUserInDb = (username: string) => {
    try {
        execSync(
            `docker compose exec -i db psql -U sentinel -d savanna_sentinel -c "UPDATE users SET is_active = true WHERE username = '${username}'";`,
            { stdio: "ignore" },
        );
    } catch (e) {
        console.log("DB activation script failed: ", e);
    }
};

test.describe("User profile update logic", () => {
    let userCleanup: ReturnType<typeof generateUser> | null = null;

    test.beforeAll(async ({ request }) => {
        userCleanup = null;

        const newUser = generateUser();
        const registration = await request.post(
            `${BASE_API_URL}/v1/auth/register`,
            {
                data: newUser,
            },
        );
        expect(registration.status()).toBe(201);

        activateUserInDb(newUser.username);

        userCleanup = newUser;
    });
    test.afterAll(async () => {
        if (userCleanup) {
            deleteUserFromDb(userCleanup.email, userCleanup.username);
        }
    });

    test.beforeEach(async ({ page }) => {
        await page.goto("/login");
        await page.getByPlaceholder("Username").fill(userCleanup!.username);
        await page.getByPlaceholder("Password").fill(userCleanup!.password);
        const loginButton = page.getByRole("button", { name: /log in/i });
        await loginButton.click();
        await expect(page).toHaveURL("/dashboard");
        await page.goto("/profile");
    });

    test("Should display profile details accurately", async ({ page }) => {
        await expect(
            page.getByRole("heading", { name: "Profile Details", level: 2 }),
        ).toBeVisible();
        await expect(page.locator("#first_name")).not.toHaveValue("");
    });

    test("allow changing profile name", async ({ page }) => {
        await page.locator("#first_name").fill("AnotherName");
        await page.locator("#last_name").fill("ALastName");

        const saveButton = page.getByRole("button", { name: /Save/i });
        await expect(saveButton).toBeEnabled();
        await saveButton.click();

        const dialog = page.locator("role=dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText("Confirm profile changes")).toBeVisible();

        await dialog.getByRole("button", { name: /Confirm Changes/i }).click();

        await expect(dialog).not.toBeVisible();
        await expect(
            page.getByRole("status").filter({ hasText: "Profile updated" }),
        ).toBeVisible();
        await expect(page.locator("#first_name")).toHaveValue("AnotherName");
        await expect(page.locator("#last_name")).toHaveValue("ALastName");

        //Perform cleanup by updating again
        await page.locator("#first_name").fill(userCleanup!.first_name);
        await page.locator("#last_name").fill(userCleanup!.last_name);
        await page.getByRole("button", { name: /Save/i }).click();
        await page.getByRole("button", { name: /Confirm Changes/i }).click();
    });

    test("Reset button resets values without making API calls", async ({
        page,
    }) => {
        await page.locator("#first_name").fill("AnotherName");

        const resetButton = page.getByRole("button", { name: /Reset/i });
        await expect(resetButton).toBeEnabled();
        await resetButton.click();

        await expect(page.locator("#first_name")).toHaveValue(
            userCleanup!.first_name,
        );
        await expect(resetButton).toBeDisabled();
    });

    test("Password should match frontend boundries before a submission can be made", async ({
        page,
    }) => {
        await page.locator("#current_password").fill(userCleanup!.password);
        await page.locator("#new_password").fill("NewSecurePassword123!");
        await page.locator("#confirm_password").fill("MismatchedPassword9!");

        const changePasswordButton = page.getByRole("button", {
            name: /Change Password/i,
        });

        await expect(changePasswordButton).toBeDisabled();
    });
    test("should successfully change password, redirect to login, and authenticate with new password", async ({
        page,
    }) => {
        await page.locator("#current_password").fill(userCleanup!.password);
        await page.locator("#new_password").fill("NewSecurePassword123!");
        await page.locator("#confirm_password").fill("NewSecurePassword123!");

        const changePasswordButton = page.getByRole("button", {
            name: /Change Password/i,
        });
        await expect(changePasswordButton).toBeEnabled();
        await changePasswordButton.click();
        await page.getByRole("button", { name: /Confirm Changes/i }).click();

        await expect(page).toHaveURL("/login");

        //Confirm old password no longer works
        await page.getByPlaceholder("Username").fill(userCleanup!.username);
        await page.getByPlaceholder("Password").fill(userCleanup!.password);
        const loginButton = page.getByRole("button", { name: /log in/i });
        await loginButton.click();
        await expect(page.getByText("Login failed")).toBeVisible();
        await expect(
            page.getByText(
                "Incorrect username or password. Check your details and try again.",
            ),
        ).toBeVisible();

        // Test new password works
        await page.getByPlaceholder("Password").clear();
        await page.getByPlaceholder("Password").fill("NewSecurePassword123!");
        await loginButton.click();

        await expect(page).toHaveURL("/dashboard");
    });
});
