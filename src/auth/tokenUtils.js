import jwt from "jsonwebtoken";
import crypto from "crypto";

// Access token lasts 10 minutes
export const ACCESS_TOKEN_EXPIRY = "10m";

// Refresh token lasts 7 days
export const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

export function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}
