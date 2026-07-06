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

    it("Invalid file format, first row is malformed, should display malformed error", async () => {
        const user = userEvent.setup();
        renderIngestionPage();

        const csvFile = new File(["id,wrong_col\n"], "invalid_headers.csv", {
            type: "text/csv",
        });
        const fileInput = screen.getByLabelText("CSV file upload");

        if (!fileInput) {
            throw new Error(
                "Could not find the file input element - Invalid file format, first row is malformed...'",
            );
        }

        await user.upload(fileInput, csvFile);
        const expectedError =
            "Invalid first row, please ensure that the first row matches the expected schema.";
        const error = await screen.findByText(expectedError);

        expect(error).toBeInTheDocument();
        expect(error).toHaveStyle({ color: "rgb(255, 0, 0)" });
    });

    it("Valid file format, browser experiences error reading file", async () => {
        const user = userEvent.setup();
        renderIngestionPage();

        //Mock file reader to make it throw an error everytime, simulating file error
        const readAsTextSpy = vi
            .spyOn(FileReader.prototype, "readAsText")
            .mockImplementation(function (this: FileReader) {
                const error = new ProgressEvent("error", {
                    lengthComputable: false,
                    loaded: 0,
                    total: 0,
                });

                if (this.onerror) {
                    this.onerror(error as ProgressEvent<FileReader>);
                }
            });

        const csvFile = new File(["id,status\n"], "test.csv", {
            type: "text/csv",
        });
        const fileInput = screen.getByLabelText("CSV file upload");

        if (!fileInput) {
            throw new Error(
                "Could not find the file input element - Valid file format, browser experiences error reading file'",
            );
        }

        await user.upload(fileInput, csvFile);
        const expectedError = "Error reading the file. Please contact support.";
        const error = await screen.findByText(expectedError);

        expect(error).toBeInTheDocument();
        expect(error).toHaveStyle({ color: "rgb(255, 0, 0)" });

        readAsTextSpy.mockRestore();
    });
});
