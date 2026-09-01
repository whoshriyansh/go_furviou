import { Router } from "express";
import { googleAuth, me } from "./auth.controllers";
import { protect } from "../../middleware/auth";

const router = Router();

router.post("/google", googleAuth);
router.get("/me", protect, me);

export default router;
