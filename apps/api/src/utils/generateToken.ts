import jwt from "jsonwebtoken";

export function generateToken(id: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }

  return jwt.sign({ id }, secret, { expiresIn: "7d" });
}
