import IngestionPage from "@/pages/IngestionPage";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

//Intercept the schema and replace it with a consistent schema that is seperate from the file
vi.mock("@/lib/ingestionSchema", () => {
    return {
        FILE_SCHEMA: [
            { name: "id", type: "number" },
            { name: "status", type: "string" },
        ],
    };
});

const renderIngestionPage = () => {
    return render(<IngestionPage />);
};

//NB TESTS SHOULD CHANGE WHEN PAGE IS REDESIGNED WITH MESSAGES ETC
describe("Rendering tests - File upload errors (not content) ", () => {
    //Rendering tests excluded, only doing error handling tests
    it("Valid file format, but empty file, should display empty file error", async () => {
        const user = userEvent.setup();
        renderIngestionPage();

        //Empty contents csv file
        const csvFile = new File([], "empty_records.csv", { type: "text/csv" });

        //Get the file input element by finding a hidden button or input element
        const fileInput = screen.getByLabelText("CSV file upload");

        if (!fileInput) {
            throw new Error(
                "Could not find the file input element - Failing at 'Valid file format, but empty file...'",
            );
        }

        await user.upload(fileInput, csvFile);
        const expectedError =
            "The uploaded file is empty, please ensure the first row of the file indicates column headings.";
        const error = await screen.findByText(expectedError);

        expect(error).toBeInTheDocument();
        expect(error).toHaveStyle({ color: "rgb(255, 0, 0)" });
    });
});
