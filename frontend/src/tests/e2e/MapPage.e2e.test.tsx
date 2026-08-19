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

test.describe("Heatmap page golden path", () => {
    let userCleanup: ReturnType<typeof generateUser> | null = null;

    test.beforeAll(async ({ request }) => {
        userCleanup = null;
        const newUser = generateUser();
        const registration = await request.post(
            `${BASE_API_URL}/v1/auth/register`,
            { data: newUser },
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
        await page.getByRole("button", { name: /log in/i }).click();
        await expect(page).toHaveURL("/profile");
        await page.goto("/map");
    });

    test("shows an expanded legend and a working sidebar", async ({ page }) => {
        await expect(
            page.getByRole("checkbox", { name: /risk heatmap/i }),
        ).toBeChecked();

        await expect(
            page.getByRole("button", { name: /collapse risk legend/i }),
        ).toBeVisible();
        await expect(page.getByText("Critical", { exact: true })).toBeVisible();

        const opacitySlider = page.getByLabel(/heatmap opacity/i);
        await expect(opacitySlider).toBeEnabled();

        await page.getByRole("checkbox", { name: /risk heatmap/i }).uncheck();
        await expect(opacitySlider).toBeDisabled();
    });

    test("moving the time-of-day slider updates the snapshot hint", async ({
        page,
    }) => {
        const hint = page.getByText(/^snapshot: /i);
        const initialText = await hint.textContent();

        const timeSlider = page.getByLabel(/snapshot time of day/i);
        await timeSlider.focus();
        await timeSlider.press("Home");

        await expect(hint).not.toHaveText(initialText ?? "");
        await expect(hint).toContainText("00:00");
    });

    test.describe("on a phone viewport", () => {
        test.use({ viewport: { width: 390, height: 844 } });

        test("shows a collapsed legend pill and a bottom drawer", async ({
            page,
        }) => {
            await expect(
                page.getByRole("button", { name: /expand risk legend/i }),
            ).toBeVisible();
            await expect(
                page.getByRole("button", { name: /zoom in/i }),
            ).toBeVisible();

            const drawer = page.locator('[data-slot="drawer-content"]');
            await expect(drawer).toBeVisible();
            const box = await drawer.boundingBox();
            expect(box).not.toBeNull();
            expect(box!.y).toBeLessThan(844);
        });

        test("fully collapses to just the drag handle, hiding the panel content", async ({
            page,
        }) => {
            await page.waitForTimeout(600);

            await expect(page.getByText("Time Range")).not.toBeInViewport();
        });

        async function dragDrawerTo(
            page: import("@playwright/test").Page,
            targetY: number,
            { settle = true }: { settle?: boolean } = {},
        ) {
            const drawer = page.locator('[data-slot="drawer-content"]');
            const box = (await drawer.boundingBox())!;
            const startX = box.x + box.width / 2;

            const startY = box.y + 10;

            await page.mouse.move(startX, startY);
            await page.mouse.down();
            const steps = 20;
            for (let i = 1; i <= steps; i++) {
                const y = startY + ((targetY - startY) * i) / steps;
                await page.mouse.move(startX, y);
                await page.waitForTimeout(20);
            }
            await page.mouse.up();
            if (settle) {
                await page.waitForTimeout(600);
            }
        }

        test("dragging to the midpoint moves the legend up with it", async ({
            page,
        }) => {
            const drawer = page.locator('[data-slot="drawer-content"]');
            const legend = page.getByRole("button", {
                name: /expand risk legend/i,
            });

            await page.waitForTimeout(600);

            const collapsedDrawerBox = (await drawer.boundingBox())!;
            const collapsedLegendBox = (await legend.boundingBox())!;

            await dragDrawerTo(page, 844 * 0.4);

            const expandedDrawerBox = (await drawer.boundingBox())!;
            const expandedLegendBox = (await legend.boundingBox())!;

            expect(expandedDrawerBox.y).toBeLessThan(collapsedDrawerBox.y);

            expect(expandedLegendBox.y).toBeLessThan(collapsedLegendBox.y);
        });

        test("dragging all the way down rests at the collapsed height instead of sliding off-screen", async ({
            page,
        }) => {
            const drawer = page.locator('[data-slot="drawer-content"]');

            await page.waitForTimeout(600);
            const collapsedBox = (await drawer.boundingBox())!;

            await dragDrawerTo(page, 844 + 200, { settle: false });

            const immediateBox = (await drawer.boundingBox())!;
            expect(immediateBox.y).toBeLessThan(844);

            await page.waitForTimeout(600);
            const settledBox = (await drawer.boundingBox())!;

            expect(settledBox.y).toBeLessThan(844);
            expect(Math.abs(settledBox.y - collapsedBox.y)).toBeLessThan(20);
        });

        test("can be dragged to a fully expanded step above the midpoint", async ({
            page,
        }) => {
            const drawer = page.locator('[data-slot="drawer-content"]');

            await page.waitForTimeout(600);

            await dragDrawerTo(page, 20);

            const settledBox = (await drawer.boundingBox())!;
            expect(settledBox.y).toBeLessThan(844 * 0.4);
        });

        test("legend stops moving once the sheet passes the midpoint", async ({
            page,
        }) => {
            const legend = page.getByRole("button", {
                name: /expand risk legend/i,
            });
            await page.waitForTimeout(600);

            await dragDrawerTo(page, 844 * 0.4);
            const legendAtMidpoint = (await legend.boundingBox())!;

            await dragDrawerTo(page, 20);
            const legendAtFull = (await legend.boundingBox())!;

            expect(legendAtFull.y).toBeCloseTo(legendAtMidpoint.y, 0);
        });
    });
});
