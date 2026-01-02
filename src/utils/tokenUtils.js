import jwt from "jsonwebtoken";
import crypto from "crypto";

export const ACCESS_TOKEN_EXPIRES = "1d";
export const REFRESH_TOKEN_EXPIRES_DAYS = 30;

export function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });
}

export function generateRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
