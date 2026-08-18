import { FileUploadDropzone } from "@/components/ui/file-upload-dropzone";

const ParkZoneUploadPage = () => {
    const handleFilesSelected = () => {
        return;
    }
    return (
        <FileUploadDropzone
            inputId="park-geojson-file"
            //Expand later with testing
            accept=".geojson" 
            title="Upload WGS84 Boundary File here (.geojson)"
            hint="Upload the shape file of the game reserve."
            onFilesSelected={handleFilesSelected}
        />
    )
}

export default ParkZoneUploadPage;