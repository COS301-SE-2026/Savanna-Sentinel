import { test, expect } from "@playwright/test";

test("Login redirect works", async ({ page }) => {
    await page.goto("/login");
    const heading = page.getByRole("heading", { name: /login/i });

    await expect(heading).toHaveText(/login/i);
});
test("Login to Register works", async ({ page }) => {
    await page.goto("/login");
    const registerLink = page.getByRole("link", { name: /register/i });

    await registerLink.click();

    await expect(page).toHaveURL("/register");
    const heading = page.getByRole("heading", { name: /register/i });
    await expect(heading).toHaveText(/register/i);
});
test("Login with incorrect credentials", async ({ page }) => {
    await page.goto("/login");

    await page.getByPlaceholder("Username").fill("a");
    await page.getByPlaceholder("Password").fill("e");
    const loginButton = page.getByRole("button", { name: /log in/i });
    await loginButton.click();
    const alertMessage = page.getByRole("alert");

    await expect(alertMessage).toBeVisible();
    await expect(alertMessage).toHaveText(/Incorrect username or password/i);
});
test("Login with correct credentials", async ({ page }) => {
    await page.goto("/login/");

    await page.getByPlaceholder("Username").fill("admin1");
    await page.getByPlaceholder("Password").fill("SentinelSeed1!");
    const loginButton = page.getByRole("button", { name: /log in/i });
    await loginButton.click();

    await expect(page).toHaveURL("/dashboard");
});
test("Get automatically redirected to login when trying to access an authorised page", async ({
    page,
}) => {
    await page.goto("/profile");

    await expect(page).toHaveURL("/login");
});
