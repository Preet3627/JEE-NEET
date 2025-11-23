
declare const gapi: any;
declare const google: any;

let tokenClient: any = null;

const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest", "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];
// Added drive.file and calendar.events scopes
const SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.events";

/**
 * Initializes the GAPI client and Google Identity Services token client.
 */
export function initClient(
    clientId: string, 
    onStatusChange: (isSignedIn: boolean) => void, 
    onError: (error: any) => void
) {
    if (!window.gapi || !window.google) {
        console.error("Google API scripts not loaded");
        return;
    }

    gapi.load('client', async () => {
        try {
            await gapi.client.init({
                discoveryDocs: DISCOVERY_DOCS,
            });

            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: SCOPES,
                callback: (tokenResponse: any) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        gapi.client.setToken(tokenResponse);
                        onStatusChange(true);
                    } else {
                        console.error("Google token response was empty or invalid.", tokenResponse);
                        onStatusChange(false);
                    }
                },
                error_callback: (error: any) => {
                    console.error("Google Identity Services Error:", error);
                    if (error && error.type !== 'popup_closed') {
                        onError(error);
                    }
                    onStatusChange(false);
                }
            });

        } catch (error: any) {
            console.error("GAPI Client Init Error:", error);
            onError(error);
        }
    });
}

/**
 * Prompts the user to sign in and grant API access.
 */
export const handleSignIn = (): void => {
    if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        console.error("Token client not initialized.");
        alert("Google services are not ready. Please try again in a moment.");
    }
};

/**
 * Signs the user out.
 */
export const handleSignOut = (onStatusChange: (isSignedIn: boolean) => void): void => {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token, () => {
            gapi.client.setToken(null);
            onStatusChange(false);
        });
    }
};
