import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { cellClass, rowClass, theadClass } from "../ui/table-styles";
import { cn } from "@/lib/utils";

export interface Poi {
    name: string;
    lat: number;
    lon: number;
}

interface SelectReferenceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pois?: Poi[]
    onSelectPoi?: (poi: Poi) => void;
}


const SelectReferenceModal = ({
    open,
    onOpenChange,
}: SelectReferenceModalProps) => {

    
    return(
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent preventBackdropClose>
                <DialogHeader>
                    <DialogTitle>
                        Select Point of Interest for Location Tracking
                    </DialogTitle>
                </DialogHeader>
                <div className="relative my-4 h-64 w-full overflow-hidden rounded-md border border-color-border">
                    <Table>
                        <TableHeader className="bg-brand-primary">
                            <TableHead
                                className={cn(theadClass, "text-center")}
                            >
                                 Location Name
                            </TableHead>
                            <TableHead
                                className={cn(theadClass, "text-center")}
                            >
                                Latitude
                            </TableHead>
                            <TableHead
                                className={cn(theadClass, "text-center")}
                            >
                                Longitude
                            </TableHead>
                            <TableHead
                                className={cn(theadClass, "text-center")}
                            >
                                Actions
                            </TableHead>
                        </TableHeader>
                        <TableBody>
                            <TableRow
                                className={rowClass}
                            >
                                <TableCell
                                    colSpan={5}
                                    className={cellClass}
                                >
                                    Test Content
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default SelectReferenceModal;