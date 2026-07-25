import IngestionPage from "@/pages/IngestionPage";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ingestionApi, type IngestionResponse } from "@/services/ingestionApi";
import { notifySafe, notifyCritical } from "@/components/ui/toast";

//Intercept the schema and replace it with a consistent schema that is seperate from the file
const DEFAULT_SCHEMA = [
    { name: "id", type: "number" },
    { name: "status", type: "string" },
];
//Disabled since it must match vi standards
// eslint-disable-next-line @typescript-eslint/naming-convention
let vi_mockSchema = DEFAULT_SCHEMA;
vi.mock("@/lib/ingestionSchema", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@/lib/ingestionSchema")>();
    return {
        ...actual,
        get FILE_SCHEMA() {
            return vi_mockSchema;
        },
    };
});

vi.mock("@/services/ingestionApi", () => ({
    ingestionApi: {
        uploadFile: vi.fn(),
    },
}));

vi.mock("@/components/ui/toast", () => ({
    notifySafe: vi.fn(),
    notifyCritical: vi.fn(),
}));

const renderIngestionPage = () => {
    return render(<IngestionPage />);
};

const getFileInput = () =>
    screen.getByLabelText(/drop csv here/i, { selector: "input" });

beforeEach(() => {
    vi_mockSchema = DEFAULT_SCHEMA;
    vi.mocked(notifySafe).mockClear();
    vi.mocked(notifyCritical).mockClear();
});

describe("Rendering tests - File upload errors (not content) ", () => {
    //Rendering tests excluded, only doing error handling tests
    it("Valid file format, but empty file, should display empty file error", async () => {
        const user = userEvent.setup();
        renderIngestionPage();

        //Empty contents csv file
        const csvFile = new File([], "empty_records.csv", { type: "text/csv" });

        await user.upload(getFileInput(), csvFile);

        expect(
            await screen.findByText(/the uploaded file is empty/i),
        ).toBeInTheDocument();
    });

    it("Invalid file format, first row is malformed, should display malformed error", async () => {
        const user = userEvent.setup();
        renderIngestionPage();

        const csvFile = new File(["id,wrong_col\n"], "invalid_headers.csv", {
            type: "text/csv",
        });

        await user.upload(getFileInput(), csvFile);

        expect(
            await screen.findByText(
                /doesn't match the expected column schema/i,
            ),
        ).toBeInTheDocument();
    });

    it("Valid file format, browser experiences error reading file", async () => {
        const user = userEvent.setup();
        renderIngestionPage();

        //Mock file reader to make it throw an error everytime, simulating file error
        const readAsTextSpy = vi
            .spyOn(File.prototype, "text")
            .mockRejectedValue(
                new Error("Simulated browser file read failure"),
            );

        const csvFile = new File(["id,status\n"], "test.csv", {
            type: "text/csv",
        });

        await user.upload(getFileInput(), csvFile);

        expect(
            await screen.findByText(/couldn't read that file/i),
        ).toBeInTheDocument();

        readAsTextSpy.mockRestore();
    });

    it("Invalid file format, incorrect file type, should show only supports csv message", async () => {
        renderIngestionPage();

        const file = new File(["id,status\n1,active"], "test.txt", {
            type: "text/plain",
        });

        //Cant use user agent to try and bypass safeguards by its file handler for this test case
        fireEvent.change(getFileInput(), {
            target: { files: [file] },
        });

        expect(
            await screen.findByText(/only \.csv files are accepted/i),
        ).toBeInTheDocument();
    });
});

describe("Rendering tests - File validation tests, test various files that successfully upload but might contain errors", () => {
    it("Valid file, should display table", async () => {
        const user = userEvent.setup();
        renderIngestionPage();

        const csvFile = new File(["id,status\n1,active"], "valid.csv", {
            type: "text/csv",
        });

        await user.upload(getFileInput(), csvFile);

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

    it("Invalid file, extra column beyond the schema, should still display the known columns", async () => {
        const user = userEvent.setup();
        renderIngestionPage();

        const csvFile = new File(
            ["id,status\n1,active,extra_data"],
            "valid.csv",
            { type: "text/csv" },
        );

        await user.upload(getFileInput(), csvFile);

        const inputs = await screen.findAllByRole("textbox");

        expect(screen.getByRole("table")).toBeInTheDocument();
        expect(inputs[0]).toHaveValue("1");
        expect(inputs[1]).toHaveValue("active");
    });

    it("flags cells that fail validation with badge messages", async () => {
        const user = userEvent.setup();
        renderIngestionPage();

        const csvFile = new File(["id,status\ntest,"], "test.csv", {
            type: "text/csv",
        });

        await user.upload(getFileInput(), csvFile);
        await screen.findAllByRole("textbox");

        expect(
            screen.getByText(/expected number, got "test"/i),
        ).toBeInTheDocument();
        expect(screen.getByText(/"status" is missing/i)).toBeInTheDocument();
    });

    it("clears a cell's badge once the value is corrected", async () => {
        const user = userEvent.setup();
        renderIngestionPage();

        const csvFile = new File(["id,status\ntest,active"], "test.csv", {
            type: "text/csv",
        });

        await user.upload(getFileInput(), csvFile);
        const inputs = await screen.findAllByRole("textbox");

        expect(
            screen.getByText(/expected number, got "test"/i),
        ).toBeInTheDocument();

        await user.clear(inputs[0]);
        await user.type(inputs[0], "1");

        expect(inputs[0]).toHaveValue("1");
        expect(screen.queryByText(/expected number/i)).not.toBeInTheDocument();
    });

    it("lets the user cancel after uploading a file with invalid data", async () => {
        const user = userEvent.setup();
        renderIngestionPage();

        const csvFile = new File(["id,status\ntest,"], "test.csv", {
            type: "text/csv",
        });

        await user.upload(getFileInput(), csvFile);
        await screen.findAllByRole("textbox");

        await user.click(screen.getByRole("button", { name: /cancel/i }));

        expect(screen.queryByRole("table")).not.toBeInTheDocument();
        expect(getFileInput()).toBeInTheDocument();
    });

    it("shows a success toast after the final batch uploads", async () => {
        vi_mockSchema = [
            { name: "id", type: "number" },
            { name: "status", type: "string" },
            { name: "is_active", type: "boolean" },
        ];

        const user = userEvent.setup();
        const uploadSpy = vi
            .spyOn(ingestionApi, "uploadFile")
            .mockResolvedValue({} as IngestionResponse);

        renderIngestionPage();

        const csvFile = new File(
            ["id,status,is_active\n1,active,true"],
            "test.csv",
            { type: "text/csv" },
        );

        await user.upload(getFileInput(), csvFile);

        const submitButton = screen.getByRole("button", { name: /submit/i });
        await user.click(submitButton);

        expect(uploadSpy).toHaveBeenCalledTimes(1);
        expect(notifySafe).toHaveBeenCalledWith(
            "Upload complete",
            "The entire file has been ingested.",
        );

        uploadSpy.mockRestore();
    });
});

describe("Logic tests - Batch logic", () => {
    it("should chunk a large CSV file into correct sequential batch slices and update the progress bar", async () => {
        const user = userEvent.setup();
        renderIngestionPage();

        const headers = "id,status\n";
        // Generate an array of length 502
        const dataRows = Array.from(
            { length: 502 },
            (_, i) => `${i + 1}, pending`,
        ).join("\n");
        const largeCsvFile = new File([headers + dataRows], "test.csv", {
            type: "text/csv",
        });

        await user.upload(getFileInput(), largeCsvFile);

        const progress = await screen.findByText(
            /Rows\s*1\s*[-–]\s*500\s*of\s*503/i,
        );
        expect(progress).toBeInTheDocument();

        const progressbar = screen.getByRole("progressbar");
        expect(progressbar).toHaveAttribute("aria-valuenow");
        expect(Number(progressbar.getAttribute("aria-valuenow"))).toBeCloseTo(
            (1 / 503) * 100,
            5,
        );

        const table = screen.getByRole("table");
        const inputsBatch = table.querySelectorAll("input");

        expect(inputsBatch).toHaveLength(1000);
    }, 15000);

    it("should advance to the next batch upon successful intermediate submission", async () => {
        const user = userEvent.setup();
        const uploadSpy = vi
            .spyOn(ingestionApi, "uploadFile")
            .mockResolvedValue({} as IngestionResponse);
        renderIngestionPage();

        const headers = "id,status\n";
        // Generate an array of length 501
        const dataRows = Array.from(
            { length: 501 },
            (_, i) => `${i + 1}, pending`,
        ).join("\n");
        const largeCsvFile = new File([headers + dataRows], "test.csv", {
            type: "text/csv",
        });

        await user.upload(getFileInput(), largeCsvFile);

        const progressInfo = await screen.findByText(
            /Rows\s*1\s*[-–]\s*500\s*of\s*502/i,
        );
        expect(progressInfo).toBeInTheDocument();

        const submitButton = screen.getByRole("button", { name: /submit/i });
        await user.click(submitButton);

        expect(uploadSpy).toHaveBeenCalledTimes(1);

        const progress = await screen.findByText(
            /Rows\s*501\s*[-–]\s*501\s*of\s*502/i,
        );
        expect(progress).toBeInTheDocument();

        uploadSpy.mockRestore();
    });

    it("should test complete sequence and clean up after last batch of file is submitted", async () => {
        const user = userEvent.setup();
        const uploadSpy = vi
            .spyOn(ingestionApi, "uploadFile")
            .mockResolvedValue({} as IngestionResponse);
        renderIngestionPage();

        const csvFile = new File(
            ["id,status\n1,active\n2,active\n3,active\n4,active\n5,active"],
            "test.csv",
            { type: "text/csv" },
        );

        await user.upload(getFileInput(), csvFile);

        const submitButton = screen.getByRole("button", { name: /submit/i });
        await user.click(submitButton);

        const success = await screen.findByText(/upload complete/i);
        expect(success).toBeInTheDocument();

        expect(screen.queryByRole("table")).not.toBeInTheDocument();
        expect(notifySafe).toHaveBeenCalledWith(
            "Upload complete",
            "The entire file has been ingested.",
        );

        await user.click(
            screen.getByRole("button", { name: /upload another file/i }),
        );
        expect(getFileInput()).toBeInTheDocument();

        uploadSpy.mockRestore();
    });

    it("surfaces nested server validation error details on the batch", async () => {
        const user = userEvent.setup();

        const customError = {
            response: {
                status: 422,
                data: {
                    detail: {
                        message:
                            "Validation failed for some records on this batch, please correct and reupload",
                        errors: {
                            row_1: [
                                {
                                    column: "status",
                                    error_type: "string_type",
                                    message: "Input should be a valid string",
                                },
                            ],
                        },
                    },
                },
            },
        };

        const uploadSpy = vi
            .spyOn(ingestionApi, "uploadFile")
            .mockRejectedValue(customError);
        renderIngestionPage();

        const csvFile = new File(["id,status\n1,12345"], "test.csv", {
            type: "text/csv",
        });

        await user.upload(getFileInput(), csvFile);

        const submitButton = screen.getByRole("button", { name: /submit/i });
        await user.click(submitButton);

        expect(uploadSpy).toHaveBeenCalledTimes(1);

        const summary = await screen.findByText(
            /Validation failed for some records/i,
        );
        expect(summary).toBeInTheDocument();
        expect(
            screen.getByText("Input should be a valid string"),
        ).toBeInTheDocument();

        const badStatus = screen.getByDisplayValue("12345");
        expect(badStatus).toHaveAttribute("aria-invalid", "true");

        uploadSpy.mockRestore();
    });
});
