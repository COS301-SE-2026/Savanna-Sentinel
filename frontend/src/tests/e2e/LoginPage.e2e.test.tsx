import {Browser, Builder, type ThenableWebDriver } from "selenium-webdriver"
import { describe, it, expect, beforeAll, afterAll} from "vitest"
import chrome from "selenium-webdriver/chrome"

const BASE_URL = " http://localhost:5173"

describe("Example test", () => {
    let driver: ThenableWebDriver
    beforeAll(async () => {
        const options = new chrome.Options()
        options.addArguments("--headless=new")
        options.addArguments("--no-sandbox")
        options.addArguments("--disable-dev-shm-usage")

        driver = new Builder()
        .forBrowser(Browser.CHROME)
        .setChromeOptions(options)
        .build()
    })

    afterAll(async () => {
        if(driver){
            await driver.quit()
        }
    })

    it("Example 1", async () => {
        await driver.get(`${BASE_URL}/login`);
        const title = driver.getTitle();
        console.log("Logged Title:", title)
        expect(title).toBeDefined()
    })
})