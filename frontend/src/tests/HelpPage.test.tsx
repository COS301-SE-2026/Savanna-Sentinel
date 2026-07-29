import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HelpPage from "@/pages/HelpPage";
import { describe, it, expect, vi } from "vitest";

describe("Help Page tests", () => {
    it("renders the help page and tab content", async () => {
        const user = userEvent.setup();

        const changeTabCheck = async (tabName: string, check: string) => {
            await user.click(screen.getByRole("tab", { name: tabName }));
            expect(screen.getByText(check)).toBeInTheDocument();
        }

        render(<HelpPage />);
        expect(screen.getByText("Frequently Asked Questions")).toBeInTheDocument();
        changeTabCheck("Reports", "Field Reports");
        changeTabCheck("Patrol Planner", "Route Parameters");
        changeTabCheck("User Profile", "Change Password");

        await user.click(screen.getByRole("tab", { name: "User Manual" }));
        expect(screen.getByRole("button", { name: "Click to Download the User Manual"}));
    });

    it("User manual download button downloads file", async () => {
        const user = userEvent.setup();
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
        render(<HelpPage />);
        await user.click(screen.getByRole("tab", { name: "User Manual" }));
        await user.click(screen.getByRole("button", { name: "Click to Download the User Manual"}));
        expect(clickSpy).toHaveBeenCalledOnce();

        // TODO ONCE FILE ACTUALLY DONE
        // const anchorInstance = clickSpy.mock.instances[0] as HTMLAnchorElement;
        // expect(anchorInstance.getAttribute("download")).toBe("User_Manual.pdf"); // update to match your filename
        // expect(anchorInstance.getAttribute("href")).toContain("user-manual.pdf"); // update to match your file path or URL
        // clickSpy.mockRestore();
    });
});