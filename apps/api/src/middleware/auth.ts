import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user";

export type AuthUser = {
  id: string;
  email: string;
  displayName?: string;
  avatar?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function protect(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    const secret = process.env.JWT_SECRET;

    if (!token || !secret) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const decoded = jwt.verify(token, secret) as { id: string };
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "Not authorized" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatar: user.avatar,
    };

    next();
  } catch {
    return res.status(401).json({ message: "Not authorized" });
  }
}
