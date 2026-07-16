import IngestionPage from "@/pages/IngestionPage";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ingestionApi, type IngestionResponse } from "@/services/ingestionApi";

//Intercept the schema and replace it with a consistent schema that is seperate from the file
//Disabled since it must match vi standards
// eslint-disable-next-line @typescript-eslint/naming-convention
let vi_mockSchema = [
    { name: "id", type: "number" },
    { name: "status", type: "string" },
];
vi.mock("@/lib/ingestionSchema", () => {
    return {
        get FILE_SCHEMA() {
            return vi_mockSchema;
        },
    };
});

vi.mock("@/services/ingestionApu", () => ({
    ingestionApi: {
        uploadFile: vi.fn()
    }
}))

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

    it("Invalid file, invalid data types, show highlight text entries", async () => {
        vi_mockSchema = [
            { name: "id", type: "number" },
            { name: "status", type: "string" },
            { name: "is_active", type: "boolean" },
            { name: "submitted_date", type: "date" },
        ];
        const user = userEvent.setup();
        renderIngestionPage();

        const csvFile = new File(
            ["id,status,is_active,submitted_date\ntest,active,incorrect,today"],
            "test.csv",
            {
                type: "text/csv",
            },
        );

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
        expect(inputs[2]).toHaveValue("incorrect");
        expect(inputs[3]).toHaveValue("today");
        expect(inputs[0]).toHaveStyle({
            color: "rgb(255,0,0)",
            fontWeight: "bold",
        });
        expect(inputs[2]).toHaveStyle({
            color: "rgb(255,0,0)",
            fontWeight: "bold",
        });
        expect(inputs[3]).toHaveStyle({
            color: "rgb(255,0,0)",
            fontWeight: "bold",
        });

        //Reset
        vi_mockSchema = [
            { name: "id", type: "number" },
            { name: "status", type: "string" },
        ];
    });
    it("Invalid file, invalid data types, style updates correctly when editted", async () => {
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

        //simulate user typing
        await user.clear(inputs[0]);
        await user.type(inputs[0], "1");

        expect(inputs[0]).toHaveValue("1");
        expect(inputs[0]).toHaveStyle({
            color: "rgb(0, 0, 0)",
            fontWeight: "normal",
        });
    });

    it("Valid file, correctly gets parsed into a JSON object", async () => {
        vi_mockSchema = [
            { name: "id", type: "number" },
            { name: "status", type: "string" },
            { name: "is_active", type: "boolean" },
        ];

        const user = userEvent.setup();
        const alertSpy = vi
            .spyOn(globalThis, "alert")
            .mockImplementation(() => {});
        const uploadSpy = vi.spyOn(ingestionApi, "uploadFile").mockResolvedValue({} as IngestionResponse)

        renderIngestionPage();

        const csvFile = new File(
            ["id,status,is_active\n1,active,true"],
            "test.csv",
            {
                type: "text/csv",
            },
        );
        const fileInput = screen.getByLabelText("CSV file upload");

        if (!fileInput) {
            throw new Error(
                "Could not find the file input element - Failing at 'Invalid file, should display table with higlighted cells...'",
            );
        }
        await user.upload(fileInput, csvFile);

        const submitButton = screen.getByRole("button", { name: /Submit/i });
        await user.click(submitButton);

        //Not the best test, could be improved in integration tests to check json is being sent correctly
        expect(uploadSpy).toHaveBeenCalledTimes(1);
        expect(alertSpy).toHaveBeenCalledWith("Success! The entire file has been uploaded");

        vi_mockSchema = [
            { name: "id", type: "number" },
            { name: "status", type: "string" },
        ];
        alertSpy.mockRestore();
        uploadSpy.mockRestore();
    });
});

describe("Logic tests - Batch logic", () => {
    it("should chunk a large CSV file into correct sequential batch slices", async () => {
        vi_mockSchema = [
            { name: "id", type: "number" },
            { name: "status", type: "string" },
        ];

        const user = userEvent.setup();
        renderIngestionPage();

        const headers = "id,status\n";
        // Generate an array of length 502
        const dataRows = Array.from({length: 502}, (_, i) => `${i + 1}, pending`).join("\n");
        const largeCsvFile = new File([headers + dataRows], "test.csv", {type: "text/csv"});

        const fileInput = screen.getByLabelText("CSV file upload");
        await user.upload(fileInput, largeCsvFile);

        expect(screen.getByText(/Displaying rows 1 to 500/i)).toBeInTheDocument();
        const inputsBatch = await screen.findAllByRole("textbox")

        expect(inputsBatch).toHaveLength(1000)

    })
    it("should advance to the next batch upon successful intermediate submission", async () => {
        vi_mockSchema = [
            { name: "id", type: "number" },
            { name: "status", type: "string" },
        ];

        const user = userEvent.setup();
        const uploadSpy = vi.spyOn(ingestionApi, "uploadFile").mockResolvedValue({} as IngestionResponse)
        renderIngestionPage();

        const headers = "id,status\n";
        // Generate an array of length 501
        const dataRows = Array.from({length: 501}, (_, i) => `${i + 1}, pending`).join("\n");
        const largeCsvFile = new File([headers + dataRows], "test.csv", {type: "text/csv"});

        const fileInput = screen.getByLabelText("CSV file upload");
        await user.upload(fileInput, largeCsvFile);

        expect(screen.getByText(/Displaying rows 1 to 500/i)).toBeInTheDocument()

        const submitButton = screen.getByRole("button", { name: /Submit/i });
        await user.click(submitButton);

        expect(uploadSpy).toHaveBeenCalledTimes(1);

        const progress = await screen.findByText(/Displaying rows 501 to 501/i);
        expect(progress).toBeInTheDocument();

        uploadSpy.mockRestore();
    })
    it("should test complete sequence and clean up after last batch of file is submitted", async () => {
        vi_mockSchema = [
            { name: "id", type: "number" },
            { name: "status", type: "string" },
        ];

        const user = userEvent.setup();
        const uploadSpy = vi.spyOn(ingestionApi, "uploadFile").mockResolvedValue({} as IngestionResponse)
        const alertSpy = vi.spyOn(globalThis, "alert").mockImplementation(() => {});
        renderIngestionPage();

        const csvFile = new File(
            ["id,status\n1,active\n2,active\n3,active\n4,active\n5,active"],
            "test.csv",
            {type: "text/csv"}
        )

        const fileInput = screen.getByLabelText("CSV file upload");
        await user.upload(fileInput, csvFile);

        const submitButton = screen.getByRole("button", { name: /Submit/i });
        await user.click(submitButton);

        const success = await screen.findByText(/File batching sequence complete/i);
        expect(success).toBeInTheDocument;

        expect(screen.queryByRole("table")).not.toBeInTheDocument();
        expect(alertSpy).toHaveBeenCalledWith("Success! The entire file has been uploaded");

        alertSpy.mockRestore();
        uploadSpy.mockRestore();
    })
    it("parses and alerts nested error detail messages", async() => {
        vi_mockSchema = [
            { name: "id", type: "number" },
            { name: "status", type: "string" },
        ];

        const user = userEvent.setup();

        const customError = {
            response: {
                status: 422,
                data: {
                    detail: {
                        message: "Validation failed for some records on this batch, please correct and reupload",
                        errors: {
                            "row_1": [
                                {
                                    "column": "status",
                                    "error_type": "string_type",
                                    "message": "Input should be a valid string"
                                }
                            ]
                        }
                    }
                }
            }
        };

        const uploadSpy = vi.spyOn(ingestionApi, "uploadFile").mockRejectedValue(customError);
        renderIngestionPage();

        const csvFile = new File(
            ["id,status\n1,12345"],
            "test.csv",
            {type: "text/csv"}
        )
        const fileInput = screen.getByLabelText("CSV file upload");
        await user.upload(fileInput, csvFile);

        const submitButton = screen.getByRole("button", { name: /Submit/i });
        await user.click(submitButton);

        expect(uploadSpy).toHaveBeenCalledTimes(1);

        const summary = await screen.findByText(/Validation failed for some records/i);
        expect(summary).toBeInTheDocument();

        const badStatus = screen.getByDisplayValue("12345");

        expect(badStatus).toHaveClass("border-red-500");

        uploadSpy.mockRestore();
    })
})