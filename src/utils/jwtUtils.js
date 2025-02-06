import jwt from "jsonwebtoken";

export const generateToken = (user) => {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET_KEY,
    { expiresIn: "1h" }
  );
};
