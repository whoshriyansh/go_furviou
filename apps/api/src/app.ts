import express from "express";
import cors from "cors";
import "dotenv/config";
import morgan from "morgan";
import helmet from "helmet";
import mongoose from "mongoose";
import authRoutes from "./modules/auth/auth.routes";
import campaignRoutes from "./modules/campaigns/campaign.routes";
import leadRoutes from "./modules/leads/lead.routes";
import mailboxRoutes from "./modules/mailbox/mailbox.routes";
import { pingRedis } from "./queue/sendQueue";

const app = express();
app.set("etag", false);
if (process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}
app.use(
  cors({
    origin: (
      process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      "http://localhost:3000"
    )
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean),
  }),
);
app.use(express.json({ limit: "5mb" }));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

async function health(_req: express.Request, res: express.Response) {
  let redis = "ok";
  try {
    await pingRedis();
  } catch {
    redis = "down";
  }
  const mongo = mongoose.connection.readyState === 1 ? "ok" : "down";
  const ok = redis === "ok" && mongo === "ok";
  res.status(ok ? 200 : 503).json({ ok, mongo, redis });
}

app.get("/", health);
app.get("/api/health", health);

app.use("/api/auth", authRoutes);
app.use("/api/mailboxes", mailboxRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/leads", leadRoutes);

export default app;
