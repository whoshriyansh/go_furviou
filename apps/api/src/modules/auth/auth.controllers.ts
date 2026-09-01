import type { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import User from "../../models/user";
import { generateToken } from "../../utils/generateToken";

function publicUser(user: {
  id: string;
  email: string;
  displayName?: string;
  avatar?: string;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatar: user.avatar,
  };
}

export async function googleAuth(req: Request, res: Response) {
  try {
    const credential = req.body?.credential as string | undefined;
    const clientId = process.env.GOOGLE_CLIENT_ID;

    if (!credential) {
      return res.status(400).json({ message: "Missing Google credential" });
    }

    if (!clientId) {
      return res.status(500).json({ message: "Google auth is not configured" });
    }

    const googleClient = new OAuth2Client(clientId);
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      return res
        .status(400)
        .json({ message: "Google account is not verified" });
    }

    const email = payload.email.toLowerCase();
    const googleId = payload.sub;

    let user = await User.findOne({
      $or: [{ googleId }, { email }],
    });

    if (user?.googleId && user.googleId !== googleId) {
      return res.status(409).json({ message: "Email already in use" });
    }

    if (!user) {
      try {
        user = await User.create({
          email,
          firstName: payload.given_name,
          displayName: payload.name,
          avatar: payload.picture,
          isFromGoogle: true,
          googleId,
        });
      } catch (error) {
        const duplicate =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === 11000;

        if (!duplicate) {
          throw error;
        }

        user = await User.findOne({ email });
        if (!user) {
          throw error;
        }
      }
    }

    if (!user.googleId) {
      user.googleId = googleId;
      user.isFromGoogle = true;
      user.firstName = user.firstName || payload.given_name;
      user.displayName = user.displayName || payload.name;
      user.avatar = user.avatar || payload.picture;
      await user.save();
    }

    const token = generateToken(user.id);
    return res.status(200).json({
      token,
      user: publicUser(user),
    });
  } catch {
    return res.status(401).json({ message: "Invalid Google token" });
  }
}

export async function me(req: Request, res: Response) {
  return res.status(200).json({ user: req.user });
}
