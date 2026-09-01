import { Router } from "express";
import { protect } from "../../middleware/auth";
import { listAllLeads } from "./lead.controllers";

const router = Router();

router.get("/", protect, listAllLeads);

export default router;
