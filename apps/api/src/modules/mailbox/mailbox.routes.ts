import { Router } from "express";
import { protect } from "../../middleware/auth";
import {
  listMailboxes,
  removeMailbox,
  startGmailConnect,
} from "./mailbox.controllers";

const router = Router();

router.get("/gmail/connect", protect, startGmailConnect);
router.get("/", protect, listMailboxes);
router.delete("/:id", protect, removeMailbox);

export default router;
