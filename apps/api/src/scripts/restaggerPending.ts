import "dotenv/config";
import Campaign from "../models/campaign";
import { recoverPendingSendJobs } from "../queue/sendQueue";
import ConnectDB from "../db/ConnectDB";
import { restaggerPendingLeads } from "../modules/campaigns/sendSlot";

async function main() {
  await ConnectDB();
  const campaigns = await Campaign.find({ status: "active" });
  let total = 0;

  for (const campaign of campaigns) {
    const result = await restaggerPendingLeads(campaign);
    total += result.count;
    console.info("[restagger]", {
      campaign: campaign.name,
      leads: result.count,
      firstAt: result.firstAt?.toISOString() || null,
      lastAt: result.lastAt?.toISOString() || null,
      gapSeconds: campaign.delayBetweenLeadsSeconds,
    });
  }

  const jobs = await recoverPendingSendJobs();
  console.info("[restagger] done", { campaigns: campaigns.length, leads: total, jobs });
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
