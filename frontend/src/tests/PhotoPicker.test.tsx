import * as React from "react";
import { beforeAll, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhotoPicker } from "@/components/reports/PhotoPicker";
import type { PhotoAttachment } from "@/types/reports";

function Harness({ initial = [] }: { initial?: PhotoAttachment[] }) {
    const [photos, setPhotos] = React.useState<PhotoAttachment[]>(initial);
    return <PhotoPicker photos={photos} onChange={setPhotos} />;
}

function makeFile(name: string, type: string, sizeBytes: number) {
    const file = new File([new Uint8Array(sizeBytes)], name, { type });
    return file;
}

describe("PhotoPicker", () => {
    beforeAll(() => {
        URL.createObjectURL = vi.fn(() => "blob:mock-url");
        URL.revokeObjectURL = vi.fn();
    });

    it("adds a thumbnail when a valid image is selected", async () => {
        render(<Harness />);
        const input = screen.getByLabelText(/add photos/i, {
            selector: "input",
        });
        const file = makeFile("snare.jpg", "image/jpeg", 1000);
        await userEvent.upload(input, file);
        expect(screen.getAllByRole("img")).toHaveLength(1);
    });

    it("removes a thumbnail when its remove button is clicked", async () => {
        render(<Harness />);
        const input = screen.getByLabelText(/add photos/i, {
            selector: "input",
        });
        await userEvent.upload(
            input,
            makeFile("snare.jpg", "image/jpeg", 1000),
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Remove photo 1" }),
        );
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("rejects a non-image file", async () => {
        render(<Harness />);
        const input = screen.getByLabelText(/add photos/i, {
            selector: "input",
        });
        await userEvent.upload(
            input,
            makeFile("notes.txt", "text/plain", 100),
            { applyAccept: false },
        );
        expect(screen.getByText(/isn't an image file/i)).toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("rejects a file over 10MB", async () => {
        render(<Harness />);
        const input = screen.getByLabelText(/add photos/i, {
            selector: "input",
        });
        const tooBig = makeFile("big.jpg", "image/jpeg", 11 * 1024 * 1024);
        await userEvent.upload(input, tooBig);
        expect(screen.getByText(/over the 10MB limit/i)).toBeInTheDocument();
    });

    it("rejects adding a 6th photo", async () => {
        const initial: PhotoAttachment[] = Array.from(
            { length: 5 },
            (_, i) => ({
                file: makeFile(`p${i}.jpg`, "image/jpeg", 100),
                previewUrl: `blob:existing-${i}`,
            }),
        );
        render(<Harness initial={initial} />);
        const input = screen.getByLabelText(/add photos/i, {
            selector: "input",
        });
        await userEvent.upload(input, makeFile("p6.jpg", "image/jpeg", 100));
        expect(screen.getByText(/up to 5 photos/i)).toBeInTheDocument();
        expect(screen.getAllByRole("img")).toHaveLength(5);
    });
});
