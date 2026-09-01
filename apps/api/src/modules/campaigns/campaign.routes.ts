import { Router } from "express";
import { protect } from "../../middleware/auth";
import {
  createCampaign,
  getCampaign,
  launchCampaign,
  listCampaigns,
  pauseCampaign,
  resumeCampaign,
  sendNowCampaign,
  updateCampaign,
} from "./campaign.controllers";
import {
  importCampaignLeads,
  listCampaignLeads,
} from "../leads/lead.controllers";

const router = Router();

router.post("/", protect, createCampaign);
router.get("/", protect, listCampaigns);
router.get("/:id", protect, getCampaign);
router.patch("/:id", protect, updateCampaign);
router.post("/:id/launch", protect, launchCampaign);
router.post("/:id/pause", protect, pauseCampaign);
router.post("/:id/resume", protect, resumeCampaign);
router.post("/:id/send-now", protect, sendNowCampaign);
router.post("/:id/leads/import", protect, importCampaignLeads);
router.get("/:id/leads", protect, listCampaignLeads);

export default router;
