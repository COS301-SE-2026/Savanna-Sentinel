import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadWizard } from "@/components/ingestion/UploadWizard";
import { FILE_SCHEMA } from "@/lib/ingestionSchema";

const header = FILE_SCHEMA.map((c) => c.name).join(",");

function makeCsvFile(content: string, name = "data.csv") {
    return new File([content], name, { type: "text/csv" });
}

describe("UploadWizard", () => {
    it("rejects non-csv files", async () => {
        const onFileAccepted = vi.fn();
        const user = userEvent.setup({ applyAccept: false });
        render(<UploadWizard onFileAccepted={onFileAccepted} />);

        const input = screen.getByLabelText(/drop csv here/i, {
            selector: "input",
        });
        await user.upload(
            input,
            new File(["x"], "data.txt", { type: "text/plain" }),
        );

        expect(
            await screen.findByText(/only \.csv files/i),
        ).toBeInTheDocument();
        expect(onFileAccepted).not.toHaveBeenCalled();
    });

    it("rejects a header row that doesn't match the schema", async () => {
        const onFileAccepted = vi.fn();
        const user = userEvent.setup();
        render(<UploadWizard onFileAccepted={onFileAccepted} />);

        const input = screen.getByLabelText(/drop csv here/i, {
            selector: "input",
        });
        await user.upload(input, makeCsvFile("wrong,header\n1,2"));

        expect(
            await screen.findByText(
                /doesn't match the expected column schema/i,
            ),
        ).toBeInTheDocument();
        expect(onFileAccepted).not.toHaveBeenCalled();
    });

    it("accepts a valid file and reports parsed lines with the filename", async () => {
        const onFileAccepted = vi.fn();
        const user = userEvent.setup();
        render(<UploadWizard onFileAccepted={onFileAccepted} />);

        const input = screen.getByLabelText(/drop csv here/i, {
            selector: "input",
        });
        await user.upload(input, makeCsvFile(`${header}\nrow1data`));

        expect(onFileAccepted).toHaveBeenCalledWith(
            [header, "row1data"],
            "data.csv",
        );
    });
});
