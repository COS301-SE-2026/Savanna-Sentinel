//THESE TESTS SHOULD ONLY BE RUN WITH 1 WORKER, ELSE RACE CONDITIONS MIGHT OCCUR
import { test, expect } from "@playwright/test"
import { execSync } from "child_process";

const generateUser = () => {
    const seed = Math.random().toString(36).substring(2,7)
    return{
        username: `user_${seed}`,
        email: `test_${seed}@email.com`,
        password: "SuperSecretPassword123!",
        first_name: "Test",
        last_name: "Subject",
        requested_role: "ranger"
    };
}

const BASE_API_URL = "http://localhost:8000"


const deleteUserFromDb = (email: string, username: string) => {
    try {
        execSync(`docker compose exec -i db psql -U sentinel -d savanna_sentinel -c "DELETE FROM users WHERE email = '${email}' OR username = '${username}';"`, { stdio: "ignore" });
    }
    catch(e){
        console.log("DB container not ready or cleanup script failed: ", e);
    }
}
const activateUserInDb = (username: string) => {
    try{
        execSync(
            `docker compose exec -i db psql -U sentinel -d savanna_sentinel -c "UPDATE users SET is_active = true WHERE username = '${username}'";`,
        {stdio: "ignore"})
    }
    catch(e){
        console.log("DB activation script failed: ", e);
    }
}

test.describe("User profile update logic", () => {
    let userCleanup: ReturnType<typeof generateUser> | null = null;

    test.beforeAll(async ({request}) => {
        userCleanup = null;

        const newUser = generateUser();
        const registration = await request.post(`${BASE_API_URL}/v1/auth/register`, {
            data: newUser
        })
        expect(registration.status()).toBe(201);

        activateUserInDb(newUser.username);

        userCleanup = newUser
    })
    test.afterAll(async () => {
        if(userCleanup){
            deleteUserFromDb(userCleanup.email, userCleanup.username)
        }
    })

    test.beforeEach(async ({page}) => {
        await page.goto("/login");
        await page.getByPlaceholder("Username").fill(userCleanup!.username);
        await page.getByPlaceholder("Password").fill(userCleanup!.password);
        const loginButton = page.getByRole("button", {name: /log in/i});
        await loginButton.click();
        await expect(page).toHaveURL("/dashboard")
        await page.goto("/profile")
    })

    test("Should display profile details accurately", async ({ page }) => {
        await expect(page.getByRole("heading", {name: "Profile Details", level: 2})).toBeVisible();
        await expect(page.locator("#first_name")).not.toHaveValue("");
    })
})