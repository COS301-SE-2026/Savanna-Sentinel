import { FileUploadDropzone } from "@/components/ui/file-upload-dropzone";
import { riskApi } from "@/services/riskApi";
import { useState } from "react";

const ParkZoneUploadPage = () => {
    const [success, setSuccess] = useState<string | null>(null)
    const handleFilesSelected = async (files: FileList | null) => {
        const file = files?.[0]
        if(!file){
            return;
        }

        await riskApi.uploadParkZone(file);
        setSuccess("Success!");

    }
    return (
        <div>
            <FileUploadDropzone
                inputId="park-geojson-file"
                //Expand later with testing
                accept=".geojson,.json" 
                title="Upload WGS84 Boundary File here (.geojson, .json)"
                hint="Upload the shape file of the game reserve."
                onFilesSelected={handleFilesSelected}
            />
            {(success !== null) && (
                <p>{success}</p>
            )}
        </div>
    )
}

export default ParkZoneUploadPage;