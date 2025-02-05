import admin from "./config/firebase.js"; // Import Firebase Admin SDK

async function generateToken() {
  const uid = "testuser123"; // A unique user ID for testing
  const customToken = await admin.auth().createCustomToken(uid);
  console.log("🔥 Firebase Token:", customToken);
}

generateToken();
