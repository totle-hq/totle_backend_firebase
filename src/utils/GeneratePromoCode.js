// src/utils/generatePromoCode.js
export function generatePromoCode(prefix = "") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoids O, I, 1, 0
  const length = Math.floor(Math.random() * 6) + 7; // random between 7–12

  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return prefix ? `${prefix}-${code}` : code;
}
