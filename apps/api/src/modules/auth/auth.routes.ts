import { Router } from "express";
import { googleAuth, me } from "./auth.controllers";
import { gmailCallback } from "../mailbox/mailbox.controllers";
import { protect } from "../../middleware/auth";

const router = Router();

router.post("/google", googleAuth);
router.get("/me", protect, me);
router.get("/gmail/callback", gmailCallback);

export default router;
