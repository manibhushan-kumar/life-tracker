// --- App Configuration ------------------------------------------------
// Static, per-deployment settings for the optional Google Drive backup
// feature. Edit the two values below once per deployment - the app no
// longer asks the user to type a Client ID or folder name into a form.
//
// The OAuth Client ID is NOT a secret. It's designed to ship in
// client-side code - Google restricts what it can do via "Authorized
// JavaScript origins" configured on the Client ID itself in Google Cloud
// Console (APIs & Services > Credentials), not by hiding this value.
// This app also never needs a Client SECRET: Google Identity Services'
// token client uses the browser-side OAuth flow, which has no secret to
// leak in the first place.
//
// To get a Client ID: Google Cloud Console > APIs & Services >
// Credentials > Create Credentials > OAuth client ID > Web application.
// Add this site's origin(s) (e.g. https://manibhushan-kumar.github.io)
// under "Authorized JavaScript origins", then paste the generated ID below.

const GOOGLE_OAUTH_CLIENT_ID = '1093951580426-47u9ubrcu0b2tgioevkfq2ocm1ard0ql.apps.googleusercontent.com';

// The Drive folder (created in the signed-in user's own Drive) that all
// backups live under. Safe to rename any time - a new folder with the new
// name is created on the next backup; it won't touch or migrate the old one.
const GOOGLE_DRIVE_BACKUP_FOLDER_NAME = 'Life-Tracker';

// True once someone has actually replaced the placeholder above. Used to
// show a helpful "not configured yet" state instead of a Google popup that
// fails with a confusing error.
function isGoogleDriveConfigured() {
  return !!GOOGLE_OAUTH_CLIENT_ID && !GOOGLE_OAUTH_CLIENT_ID.startsWith('YOUR_CLIENT_ID');
}
