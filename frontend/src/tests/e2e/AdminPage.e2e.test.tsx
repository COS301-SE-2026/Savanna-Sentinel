import {test, expect} from "@playwright/test"
import { execSync } from "child_process"

const BASE_API_URL = "http://localhost:8000"

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

test.describe("Admin authorising registrations", () => {
    let userCleanup: ReturnType<typeof generateUser> | null = null;

    //Login to the admin account before each test
    test.beforeEach(async ({ page }) => {
        userCleanup = null;

        await page.goto("/login");

        await page.getByPlaceholder("Username").fill("admin1");
        await page.getByPlaceholder("Password").fill("SentinelSeed1!");
        const loginButton = page.getByRole("button", {name: /log in/i});
        await loginButton.click();

        await expect(page).toHaveURL("/dashboard")
    })

    test.afterEach(async () => {
        if(userCleanup){
            deleteUserFromDb(userCleanup.email, userCleanup.username)
        }
    })

    test("should display a new user in pending registrations and accept them", async({page, request}) => {
        const newUser = generateUser();

        userCleanup = newUser;
        
        //Add a new user to the database
        const registration = await request.post(`${BASE_API_URL}/v1/auth/register`, {
            data: newUser
        })
        expect(registration.status()).toBe(201);

        //Check that the pending user shows up
        await page.goto("/admin");
        await page.getByRole("tab", {name: /account approvals/i}).click();
        
        const fullName = `${newUser.first_name} ${newUser.last_name}`;
        const userRow = page.locator("tr").filter({ hasText: newUser.username })

        await expect(userRow).toBeVisible();
        await expect(userRow).toContainText(fullName);

        //Check that approval works
        await userRow.getByRole("button", {name: /accept/i}).click();

        const confirmDialog = page.getByRole("dialog")
        await expect(confirmDialog).toBeVisible();
        await expect(confirmDialog).toContainText("Confirm approval");

        await confirmDialog.getByRole("button", {name: /confirm/i}).click();

        await expect(userRow).not.toBeVisible();
    })

    test("should allow an admin to reject a user registration", async ({page, request}) => {
        const newUser = generateUser();

        userCleanup = newUser;
        
        //Add a new user to the database
        const registration = await request.post(`${BASE_API_URL}/v1/auth/register`, {
            data: newUser
        })
        expect(registration.status()).toBe(201);

        await page.goto("/admin");
        await page.getByRole("tab", {name: /account approvals/i}).click();
        
        const fullName = `${newUser.first_name} ${newUser.last_name}`;
        const userRow = page.locator("tr").filter({ hasText: newUser.username })

        await expect(userRow).toBeVisible();
        await expect(userRow).toContainText(fullName);

        //Check that approval works
        await userRow.getByRole("button", {name: /reject/i}).click();

        const confirmDialog = page.getByRole("dialog")
        await expect(confirmDialog).toBeVisible();
        await expect(confirmDialog).toContainText("Confirm rejection");

        await confirmDialog.getByRole("button", {name: /confirm/i}).click();

        await expect(userRow).not.toBeVisible();
    })
})

test.describe("Admin Role Swap Management", () => {
    let userCleanup: ReturnType<typeof generateUser> | null = null;

    test.beforeEach(async ({page, request }) => {
        userCleanup = null;
        await page.goto("/login");

        await page.getByPlaceholder("Username").fill("admin1");
        await page.getByPlaceholder("Password").fill("SentinelSeed1!");
        const loginButton = page.getByRole("button", {name: /log in/i});
        await loginButton.click();

        await expect(page).toHaveURL("/dashboard")

        //Prepare an active user
        const user = generateUser();
        const registration = await request.post(`${BASE_API_URL}/v1/auth/register`, {
            data: user
        })
        expect(registration.status()).toBe(201);

        activateUserInDb(user.username);
        userCleanup = user;

        await page.goto("/admin");
        await page.getByRole("tab", { name: /role management/i }).click();
    })

    test.afterEach(async () => {
        if(userCleanup){
            deleteUserFromDb(userCleanup.email, userCleanup.username)
        }
    });

    test("should allow an admin to change an active user's role", async ({page}) => {
        const userRow = page.locator("tr").filter({ hasText: userCleanup!.username });
        await expect(userRow).toBeVisible();

        const roleDropdown = userRow.locator("select");
        await roleDropdown.selectOption({value: "analyst"});

        const applyButton = userRow.getByRole("button", {name: /apply/i});
        await applyButton.click();

        const confirmDialog = page.getByRole("dialog");
        await expect(confirmDialog).toBeVisible();
        await expect(confirmDialog).toContainText("Confirm role change")

        await confirmDialog.getByRole("button", {name: /confirm/i}).click();

        const statusRow = page.locator("tr").filter({ hasText: "Role updated to Analyst." });
        await expect(statusRow).toBeVisible();
    })
})

//ADD DELETE USERS E2E TEST HERE ONCE WIRING FOR IT IS FINISHED