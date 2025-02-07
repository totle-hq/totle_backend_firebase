import admin from "firebase-admin";
import serviceAccount from "../../firebaseAdmin.json" assert { type: "json" }; // ✅ Add assertion

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;
