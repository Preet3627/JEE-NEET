declare const gapi: any;

const FOLDER_NAME = 'JEE_Scheduler_Pro_Backups';
const FILE_NAME = 'jee_scheduler_pro_data.json';

// Helper to find or create the app-specific folder in Google Drive
const getAppFolderId = async (): Promise<string> => {
    try {
        const response = await gapi.client.drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`,
            fields: 'files(id)',
        });
        
        const files = response.result.files;
        if (files && files.length > 0) {
            return files[0].id;
        } else {
            const fileMetadata = {
                'name': FOLDER_NAME,
                'mimeType': 'application/vnd.google-apps.folder'
            };
            const folderResponse = await gapi.client.drive.files.create({
                resource: fileMetadata,
                fields: 'id'
            });
            return folderResponse.result.id;
        }
    } catch (error) {
        console.error("Error getting app folder ID:", error);
        throw new Error("Could not access or create the app folder in Google Drive.");
    }
};

/**
 * Uploads data to a file in Google Drive. Creates the file if it doesn't exist,
 * otherwise updates it.
 * @param data The JSON string data to upload.
 * @param fileId The ID of the existing file, if any.
 * @returns The file ID of the created/updated file.
 */
export const uploadData = async (data: string, fileId?: string): Promise<string> => {
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;

    let requestBody: string;
    let path: string;
    let method: 'POST' | 'PATCH';

    if (fileId) {
        // ---- UPDATE EXISTING FILE ----
        path = `/upload/drive/v3/files/${fileId}`;
        method = 'PATCH';
        
        // For update, the metadata only needs to specify the mimeType, not name or parents.
        const metadata = { mimeType: 'application/json' };
        
        requestBody =
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            data +
            close_delim;
    } else {
        // ---- CREATE NEW FILE ----
        path = '/upload/drive/v3/files';
        method = 'POST';
        
        const folderId = await getAppFolderId();
        const metadata = {
            name: FILE_NAME,
            mimeType: 'application/json',
            parents: [folderId],
        };

        requestBody =
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            data +
            close_delim;
    }

    try {
        const response = await gapi.client.request({
            path,
            method,
            params: { uploadType: 'multipart' },
            headers: {
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: requestBody,
        });
        return response.result.id;
    } catch (error) {
        console.error("Google Drive upload error:", error);
        throw new Error("Failed to upload data to Google Drive.");
    }
};


/**
 * Downloads data from a file in Google Drive.
 * @param fileId The ID of the file to download.
 * @returns The content of the file as a string.
 */
export const downloadData = async (fileId: string): Promise<string> => {
    try {
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        // The response body for a text-based file is a string.
        return typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
    } catch (error) {
        console.error("Google Drive download error:", error);
        throw new Error("Failed to download data from Google Drive. The file may have been deleted or permissions changed.");
    }
};