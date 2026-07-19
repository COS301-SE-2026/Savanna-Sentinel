import {test, expect} from "@playwright/test"

test("Example 1", async ({ page }) => {
    await page.goto("/login");
    const title = await page.title();
    console.log("Logged Title: ", title);

    await expect(page).toHaveTitle(/Savanna Sentinel/)
})