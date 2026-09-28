import { Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { cellClass, rowClass, theadClass } from "../ui/table-styles";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

export interface Poi {
    id: string;
    name: string;
    lat: number;
    lon: number;
}

interface SelectReferenceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pois?: Poi[];
    onSelectPoi?: (poi: Poi) => void;
    onPreviewPoi?: (poi: Poi) => void;
};


const SelectReferenceModal = ({
    open,
    onOpenChange,
    pois = [],
    onSelectPoi,
    onPreviewPoi,
}: SelectReferenceModalProps) => {
    const handleSelectPoi = (poi: Poi) => {
        onSelectPoi?.(poi);
        onOpenChange(false)
    }
    const handlePreviewPoi = (poi: Poi) => {
        onPreviewPoi?.(poi);
    }
    
    return(
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent preventBackdropClose className="sm:max-w-md p-6">
                <DialogHeader className="pb-1">
                    <DialogTitle>
                        Select Point of Interest for Location Tracking
                    </DialogTitle>
                </DialogHeader>
                <div className="relative my-2 h-64 w-full overflow-y-auto rounded-lg border border-color-border shadow-inner">
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-brand-primary">
                            <TableHead
                                className={cn(theadClass, "text-center")}
                            >
                                 Preview
                            </TableHead>
                            <TableHead
                                className={cn(theadClass, "text-center")}
                            >
                                 Location Name
                            </TableHead>
                            <TableHead
                                className={cn(theadClass, "text-center")}
                            >
                                 Select
                            </TableHead>
                        </TableHeader>
                        <TableBody>
                            {pois.length === 0 ? (
                                <TableCell
                                    colSpan={3}
                                    className={cn(cellClass, "text-center")}
                                >
                                    No points of interest available
                                </TableCell>
                            ): (
                                pois.map((poi, i) => (
                                    <TableRow
                                        key={`${poi.lat}-${poi.lon}-${i}`}
                                        className={rowClass}
                                    >
                                        <TableCell
                                            className={cn(cellClass, "text-center")}
                                        >
                                            <div className="flex items-center justify-center">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-7 hover:bg-color-surface-hover text-color-text-secondary hover:text-brand-primary"
                                                    aria-label={`Preview ${poi.name} on map`}
                                                    title="Fly map to location"
                                                    onClick={() => handlePreviewPoi(poi)}
                                                >
                                                    <Eye className="size-4 text-color-text-secondary" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell
                                            className={cn(cellClass, "text-left")}
                                        >
                                            <div className="font-medium text-color-text-primary">
                                                {poi.name}
                                            </div>
                                        </TableCell>
                                        <TableCell
                                            className={cn(cellClass, "text-center")}
                                        >
                                            <Button
                                                size="sm"
                                                onClick={() => handleSelectPoi(poi)}
                                            >
                                                Select
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default SelectReferenceModal;