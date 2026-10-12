// ==============================================================================
// Firebase Web Configuration
// ==============================================================================
// INSTRUCTIONS:
// Replace the placeholder values below with your Firebase Web App configuration.
// You can find this in your Firebase Console:
// 1. Open https://console.firebase.google.com/
// 2. Select your Project -> Project Settings (gear icon) -> General tab.
// 3. Scroll down to "Your apps" -> select your Web App (</>).
// 4. Copy the "firebaseConfig" object values and paste them below:
// ==============================================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBISf3Rw2H3gQYPv5fcVsOGKm6NXmVOmP8",
  authDomain: "life-tracker-93ef6.firebaseapp.com",
  databaseURL: "https://life-tracker-93ef6-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "life-tracker-93ef6",
  storageBucket: "life-tracker-93ef6.firebasestorage.app",
  messagingSenderId: "326846586428",
  appId: "1:326846586428:web:7618717c5534f408f0ad39",
  measurementId: "G-1JD4R9RX1T"
};

// Helper function to check if the user has inserted their real Firebase configuration
function isFirebaseConfigured() {
  if (typeof FIREBASE_CONFIG === 'undefined' || !FIREBASE_CONFIG) return false;
  const apiKey = (FIREBASE_CONFIG.apiKey || '').trim();
  const projectId = (FIREBASE_CONFIG.projectId || '').trim();
  const databaseURL = (FIREBASE_CONFIG.databaseURL || '').trim();

  // Return true only if placeholders have been replaced with real credentials
  return (
    apiKey.length > 10 &&
    !apiKey.startsWith('YOUR_') &&
    projectId.length > 2 &&
    !projectId.startsWith('YOUR_') &&
    databaseURL.length > 10 &&
    !databaseURL.includes('YOUR_PROJECT_ID')
  );
}

// Global export for vanilla JS modules
if (typeof window !== 'undefined') {
  window.FIREBASE_CONFIG = FIREBASE_CONFIG;
  window.isFirebaseConfigured = isFirebaseConfigured;
}
