import express from "express";
import cors from "cors";
import "dotenv/config";
import morgan from "morgan";
import helmet from "helmet";
import authRoutes from "./modules/auth/auth.routes";
import mailboxRoutes from "./modules/mailbox/mailbox.routes";

const app = express();
app.use(
  cors({
    origin: (
      process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      "http://localhost:3000"
    )
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  }),
);
app.use(express.json());
app.use(helmet());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/mailboxes", mailboxRoutes);

export default app;
