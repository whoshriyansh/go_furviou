import { Router } from "express";
import { protect } from "../../middleware/auth";
import {
  checkAllMailboxes,
  checkMailbox,
  listMailboxes,
  removeMailbox,
  startGmailConnect,
} from "./mailbox.controllers";

const router = Router();

router.get("/gmail/connect", protect, startGmailConnect);
router.get("/", protect, listMailboxes);
router.post("/check-all", protect, checkAllMailboxes);
router.post("/:id/check", protect, checkMailbox);
router.delete("/:id", protect, removeMailbox);

export default router;
