import { Router } from "express";
import { protect } from "../../middleware/auth";
import { listAllLeads, importLeads } from "./lead.controllers";

const router = Router();

router.get("/", protect, listAllLeads);
router.post("/import", protect, importLeads);

export default router;
