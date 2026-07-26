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

const submitAll = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: /^submit/i }));
    await user.click(
        screen.getByRole("button", { name: /confirm submission/i }),
    );
};

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

        await user.click(screen.getByRole("button", { name: /^cancel$/i }));
        await user.click(screen.getByRole("button", { name: /discard/i }));

        expect(screen.queryByRole("table")).not.toBeInTheDocument();
        expect(getFileInput()).toBeInTheDocument();
    });

    it("shows a success toast after the file uploads", async () => {
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

        await submitAll(user);

        expect(uploadSpy).toHaveBeenCalledTimes(1);
        expect(notifySafe).toHaveBeenCalledWith(
            "Upload complete",
            "The entire file has been ingested.",
        );

        uploadSpy.mockRestore();
    });
});

describe("Logic tests - Review pagination", () => {
    const makeLargeCsv = (rowCount: number) => {
        const headers = "id,status\n";
        const dataRows = Array.from(
            { length: rowCount },
            (_, i) => `${i + 1},ok`,
        ).join("\n");
        return new File([headers + dataRows], "test.csv", {
            type: "text/csv",
        });
    };

    it("paginates a file larger than one review page instead of rendering every row at once", async () => {
        const user = userEvent.setup();
        renderIngestionPage();

        await user.upload(getFileInput(), makeLargeCsv(60));

        const table = await screen.findByRole("table");

        expect(table.querySelectorAll("input")).toHaveLength(100);
        expect(screen.getByDisplayValue("1")).toBeInTheDocument();
        expect(screen.queryByDisplayValue("51")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "2" }));

        expect(await screen.findByDisplayValue("51")).toBeInTheDocument();
        expect(screen.queryByDisplayValue("1")).not.toBeInTheDocument();
        expect(table.querySelectorAll("input")).toHaveLength(20);
    });

    it("keeps Submit (ALL) scoped to every parsed row regardless of which page is being viewed", async () => {
        const user = userEvent.setup();
        const uploadSpy = vi
            .spyOn(ingestionApi, "uploadFile")
            .mockResolvedValue({} as IngestionResponse);
        renderIngestionPage();

        await user.upload(getFileInput(), makeLargeCsv(60));
        await screen.findByRole("table");

        await user.click(screen.getByRole("button", { name: "2" }));
        await screen.findByDisplayValue("51");

        await submitAll(user);

        expect(uploadSpy).toHaveBeenCalledTimes(1);
        const [records, startRow] = uploadSpy.mock.calls[0];
        expect(records).toHaveLength(60);
        expect(startRow).toBe(1);

        uploadSpy.mockRestore();
    });
});

describe("Logic tests - Absolute row indexing across pages", () => {
    it("keys a server validation error to the file-absolute row, not the row's position on its page", async () => {
        const user = userEvent.setup();

        const customError = {
            response: {
                status: 422,
                data: {
                    detail: {
                        message:
                            "Validation failed for some records in this file, please correct and reupload",
                        errors: {
                            row_51: [
                                {
                                    column: "status",
                                    error_type: "value_error",
                                    message: "Duplicate status value",
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

        const headers = "id,status\n";
        const dataRows = Array.from(
            { length: 60 },
            (_, i) => `${i + 1},ok`,
        ).join("\n");
        const csvFile = new File([headers + dataRows], "test.csv", {
            type: "text/csv",
        });

        await user.upload(getFileInput(), csvFile);
        await screen.findByRole("table");

        await user.click(screen.getByRole("button", { name: "2" }));
        await screen.findByDisplayValue("51");

        await submitAll(user);

        expect(
            await screen.findByText("Duplicate status value"),
        ).toBeInTheDocument();

        const flaggedId = screen.getByDisplayValue("51");
        const flaggedRow = flaggedId.closest("tr");
        expect(
            flaggedRow?.querySelector('[aria-invalid="true"]'),
        ).toBeInTheDocument();

        // A different row on the same page must not be misflagged.
        const otherId = screen.getByDisplayValue("52");
        const otherRow = otherId.closest("tr");
        expect(
            otherRow?.querySelector('[aria-invalid="true"]'),
        ).not.toBeInTheDocument();

        uploadSpy.mockRestore();
    });

    it("clears a row's server error once its flagged cell is edited", async () => {
        const user = userEvent.setup();

        const customError = {
            response: {
                status: 422,
                data: {
                    detail: {
                        message: "Validation failed for some records",
                        errors: {
                            row_1: [
                                {
                                    column: "status",
                                    error_type: "value_error",
                                    message: "Duplicate status value",
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

        const csvFile = new File(["id,status\n1,dup"], "test.csv", {
            type: "text/csv",
        });

        await user.upload(getFileInput(), csvFile);
        await submitAll(user);

        const badStatus = await screen.findByDisplayValue("dup");
        expect(badStatus).toHaveAttribute("aria-invalid", "true");

        await user.clear(badStatus);
        await user.type(badStatus, "fixed");

        expect(
            screen.queryByText("Duplicate status value"),
        ).not.toBeInTheDocument();
        expect(badStatus).not.toHaveAttribute("aria-invalid", "true");

        uploadSpy.mockRestore();
    });
});

describe("Logic tests - Cancel confirmation", () => {
    it("does not discard the loaded file until the confirm dialog is accepted", async () => {
        const user = userEvent.setup();
        renderIngestionPage();

        const csvFile = new File(["id,status\n1,active"], "test.csv", {
            type: "text/csv",
        });

        await user.upload(getFileInput(), csvFile);
        await screen.findByRole("table");

        await user.click(screen.getByRole("button", { name: /^cancel$/i }));

        expect(
            await screen.findByText(/discard this upload/i),
        ).toBeInTheDocument();

        expect(document.querySelector("table")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /keep editing/i }));

        expect(
            screen.queryByText(/discard this upload/i),
        ).not.toBeInTheDocument();
        expect(screen.getByRole("table")).toBeInTheDocument();
    });

    it("discards the loaded file once the confirm dialog is accepted", async () => {
        const user = userEvent.setup();
        renderIngestionPage();

        const csvFile = new File(["id,status\n1,active"], "test.csv", {
            type: "text/csv",
        });

        await user.upload(getFileInput(), csvFile);
        await screen.findByRole("table");

        await user.click(screen.getByRole("button", { name: /^cancel$/i }));
        await user.click(screen.getByRole("button", { name: /discard/i }));

        expect(screen.queryByRole("table")).not.toBeInTheDocument();
        expect(getFileInput()).toBeInTheDocument();
    });
});

describe("Logic tests - Client-side validation gate", () => {
    it("blocks submission and never opens the confirm dialog when the file has validation errors", async () => {
        const user = userEvent.setup();
        const uploadSpy = vi.spyOn(ingestionApi, "uploadFile");
        renderIngestionPage();

        const csvFile = new File(
            ["id,status\n1,active,extra_data"],
            "test.csv",
            { type: "text/csv" },
        );

        await user.upload(getFileInput(), csvFile);
        await screen.findByRole("table");

        await user.click(screen.getByRole("button", { name: /^submit/i }));

        expect(notifyCritical).toHaveBeenCalledWith(
            "Cannot submit",
            "This file has validation errors.",
        );
        expect(
            screen.queryByText(/confirm submission/i),
        ).not.toBeInTheDocument();
        expect(uploadSpy).not.toHaveBeenCalled();

        uploadSpy.mockRestore();
    });

    it("dismisses the submit confirm dialog on Escape without submitting", async () => {
        const user = userEvent.setup();
        const uploadSpy = vi.spyOn(ingestionApi, "uploadFile");
        renderIngestionPage();

        const csvFile = new File(["id,status\n1,active"], "test.csv", {
            type: "text/csv",
        });

        await user.upload(getFileInput(), csvFile);
        await user.click(screen.getByRole("button", { name: /^submit/i }));

        expect(
            await screen.findByRole("heading", {
                name: /confirm submission/i,
            }),
        ).toBeInTheDocument();

        await user.keyboard("{Escape}");

        expect(
            screen.queryByRole("heading", { name: /confirm submission/i }),
        ).not.toBeInTheDocument();
        expect(uploadSpy).not.toHaveBeenCalled();

        uploadSpy.mockRestore();
    });

    it("closes the submit confirm dialog when its Cancel button is clicked", async () => {
        const user = userEvent.setup();
        const uploadSpy = vi.spyOn(ingestionApi, "uploadFile");
        renderIngestionPage();

        const csvFile = new File(["id,status\n1,active"], "test.csv", {
            type: "text/csv",
        });

        await user.upload(getFileInput(), csvFile);
        await user.click(screen.getByRole("button", { name: /^submit/i }));

        await screen.findByRole("heading", { name: /confirm submission/i });

        await user.click(screen.getByRole("button", { name: /^cancel$/i }));

        expect(
            screen.queryByRole("heading", { name: /confirm submission/i }),
        ).not.toBeInTheDocument();
        expect(screen.getByRole("table")).toBeInTheDocument();
        expect(uploadSpy).not.toHaveBeenCalled();

        uploadSpy.mockRestore();
    });
});

describe("Logic tests - Full-file submission and cleanup", () => {
    it("submits every parsed row in a single request and resets after success", async () => {
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

        await submitAll(user);

        expect(uploadSpy).toHaveBeenCalledTimes(1);
        const [records, startRow] = uploadSpy.mock.calls[0];
        expect(records).toHaveLength(5);
        expect(startRow).toBe(1);

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
});

describe("Logic tests - Server error parsing", () => {
    it("surfaces nested server validation error details", async () => {
        const user = userEvent.setup();

        const customError = {
            response: {
                status: 422,
                data: {
                    detail: {
                        message:
                            "Validation failed for some records in this file, please correct and reupload",
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

        await submitAll(user);

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

    it("surfaces FastAPI's raw request-validation error shape", async () => {
        const user = userEvent.setup();

        const customError = {
            response: {
                status: 422,
                data: {
                    detail: [
                        {
                            type: "int_from_float",
                            loc: ["body", "records", 0, "id"],
                            msg: "Input should be a valid integer, got a number with a fractional part",
                        },
                    ],
                },
            },
        };

        const uploadSpy = vi
            .spyOn(ingestionApi, "uploadFile")
            .mockRejectedValue(customError);
        renderIngestionPage();

        const csvFile = new File(["id,status\n1.5,active"], "test.csv", {
            type: "text/csv",
        });

        await user.upload(getFileInput(), csvFile);

        await submitAll(user);

        expect(uploadSpy).toHaveBeenCalledTimes(1);

        expect(screen.queryByText(/network issue/i)).not.toBeInTheDocument();
        expect(
            screen.getByText(
                "Input should be a valid integer, got a number with a fractional part",
            ),
        ).toBeInTheDocument();

        const badId = screen.getByDisplayValue("1.5");
        expect(badId).toHaveAttribute("aria-invalid", "true");

        uploadSpy.mockRestore();
    });

    it("falls back to a generic network-issue message when the rejection has no response body", async () => {
        const user = userEvent.setup();

        const uploadSpy = vi
            .spyOn(ingestionApi, "uploadFile")
            .mockRejectedValue(new Error("network down"));
        renderIngestionPage();

        const csvFile = new File(["id,status\n1,active"], "test.csv", {
            type: "text/csv",
        });

        await user.upload(getFileInput(), csvFile);

        await submitAll(user);

        expect(
            await screen.findByText(
                /a network issue occured while submitting this file/i,
            ),
        ).toBeInTheDocument();

        uploadSpy.mockRestore();
    });
});
