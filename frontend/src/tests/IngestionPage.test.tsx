import IngestionPage from "@/pages/IngestionPage";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
                "Could not find the file input element - Failing at 'Invalid file format, first row is malformed...'",
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
                "Could not find the file input element - Failing at 'Valid file format, browser experiences error reading file'",
            );
        }

        await user.upload(fileInput, csvFile);
        const expectedError = "Error reading the file. Please contact support.";
        const error = await screen.findByText(expectedError);

        expect(error).toBeInTheDocument();
        expect(error).toHaveStyle({ color: "rgb(255, 0, 0)" });

        readAsTextSpy.mockRestore();
    });

    it("Invalid file format, incorrect file type, should show only supports csv message", async () => {
        renderIngestionPage();

        const file = new File(["id,status\n1,active"], "test.txt", {
            type: "text/plain",
        });
        const fileInput = screen.getByLabelText("CSV file upload");

        if (!fileInput) {
            throw new Error(
                "Could not find the file input element - Failing at 'Invalid file format, incorrect file type...'",
            );
        }

        //Cant use user agent to try and bypass safeguards by its file handler for this test case
        fireEvent.change(fileInput, {
            target: { files: [file] },
        });

        const expectedError = "The program only accepts .csv files.";
        const error = await screen.findByText(expectedError);

        expect(error).toBeInTheDocument();
        expect(error).toHaveStyle({ color: "rgb(255, 0, 0)" });
    });
});

describe("Rendering tests - File validation tests, test various files that successfully upload but might contain errors", () => {
    it("Valid file, should display table", async () => {
        const user = userEvent.setup();
        renderIngestionPage();

        const csvFile = new File(["id,status\n1,active"], "valid.csv", {
            type: "text/csv",
        });
        const fileInput = screen.getByLabelText("CSV file upload");

        if (!fileInput) {
            throw new Error(
                "Could not find the file input element - Failing at 'Invalid file format, incorrect file type...'",
            );
        }

        await user.upload(fileInput, csvFile);

        const inputs = await screen.findAllByRole("textbox");

        expect(screen.getByRole("table")).toBeInTheDocument();
        expect(
            screen.getByRole("columnheader", { name: "id (number)" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("columnheader", { name: "status (string)" }),
        ).toBeInTheDocument();
        expect(inputs[0]).toHaveValue("1");
        expect(inputs[1]).toHaveValue("active");
    });

    it("Invalid file, should display table with error message saying exerted length", async () => {
        const user = userEvent.setup();
        renderIngestionPage();

        const csvFile = new File(
            ["id,status\n1,active,extra_data"],
            "valid.csv",
            {
                type: "text/csv",
            },
        );
        const fileInput = screen.getByLabelText("CSV file upload");

        if (!fileInput) {
            throw new Error(
                "Could not find the file input element - Failing at 'Invalid file, should display table with error message saying exerted length'",
            );
        }

        await user.upload(fileInput, csvFile);

        const inputs = await screen.findAllByRole("textbox");
        const expectedError =
            "Upload Successful but some errors occured: Row 1: Removed 1 extra column(s) for exerting schema length.";
        const error = await screen.findByText(expectedError);

        expect(error).toBeInTheDocument();
        expect(error).toHaveStyle({ color: "rgb(255, 0, 0)" });

        expect(screen.getByRole("table")).toBeInTheDocument();
        expect(
            screen.getByRole("columnheader", { name: "id (number)" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("columnheader", { name: "status (string)" }),
        ).toBeInTheDocument();
        expect(inputs[0]).toHaveValue("1");
        expect(inputs[1]).toHaveValue("active");
    });

    it("Invalid file, should display table with higlighted cells showing missing data", async () => {
        const user = userEvent.setup();
        renderIngestionPage();

        const csvFile = new File(["id,status\n1"], "valid.csv", {
            type: "text/csv",
        });

        const fileInput = screen.getByLabelText("CSV file upload");

        if (!fileInput) {
            throw new Error(
                "Could not find the file input element - Failing at 'Invalid file, should display table with higlighted cells...'",
            );
        }
        await user.upload(fileInput, csvFile);

        const inputs = await screen.findAllByRole("textbox");

        expect(screen.getByRole("table")).toBeInTheDocument();
        expect(
            screen.getByRole("columnheader", { name: "id (number)" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("columnheader", { name: "status (string)" }),
        ).toBeInTheDocument();
        expect(inputs[0]).toHaveValue("1");
        expect(inputs[1]).toHaveValue("");
        expect(inputs[1]).toHaveStyle({
            backgroundColor: "rgba(239,30,30,0.15)",
            color: "rgb(255,0,0)",
            fontWeight: "bold",
        });
    });

    it("Invalid file, invalid data types w/ integer, show highlight text entries", async () => {
        const user = userEvent.setup();
        renderIngestionPage();

        const csvFile = new File(["id,status\ntest,active"], "test.csv", {
            type: "text/csv",
        });

        const fileInput = screen.getByLabelText("CSV file upload");

        if (!fileInput) {
            throw new Error(
                "Could not find the file input element - Failing at 'Invalid file, should display table with higlighted cells...'",
            );
        }
        await user.upload(fileInput, csvFile);
        const inputs = await screen.findAllByRole("textbox");
        expect(screen.getByRole("table")).toBeInTheDocument();
        expect(
            screen.getByRole("columnheader", { name: "id (number)" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("columnheader", { name: "status (string)" }),
        ).toBeInTheDocument();
        expect(inputs[0]).toHaveValue("test");
        expect(inputs[1]).toHaveValue("active");
        expect(inputs[0]).toHaveStyle({
            color: "rgb(255,0,0)",
            fontWeight: "bold",
        });
    });
});
