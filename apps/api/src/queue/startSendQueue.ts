import { Worker } from "bullmq";
import { Types } from "mongoose";
import { processOne, recordSendResult } from "../modules/campaigns/sendWorker";
import CampaignLead from "../models/campaignLead";
import {
  JOB_SEND,
  JOB_SWEEP,
  SEND_QUEUE_NAME,
  createRedisConnection,
  enqueueDueSends,
  pingRedis,
  recoverPendingSendJobs,
  sendQueue,
  syncEnrollmentJob,
  type SendJobData,
} from "./sendQueue";

let worker: Worker | null = null;

export async function startSendQueue() {
  const sweepMs = Number(
    process.env.SEND_SWEEP_INTERVAL_MS || process.env.SEND_INTERVAL_MS || 30000,
  );

  try {
    await pingRedis();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Redis is not reachable (${message}). Start it with:\n  docker run -d --name furviou-redis -p 6379:6379 redis:7-alpine`,
    );
  }

  worker = new Worker(
    SEND_QUEUE_NAME,
    async (job) => {
      if (job.name === JOB_SWEEP) {
        const due = await enqueueDueSends();
        if (due) {
          console.info("[send] sweep", { due });
        }
        return { due };
      }

      const data = job.data as SendJobData;
      const result = await processOne(new Types.ObjectId(data.campaignLeadId), {
        ignoreWindow: data.ignoreWindow,
      });
      recordSendResult(result);
      const enrollment = await CampaignLead.findById(data.campaignLeadId);
      await syncEnrollmentJob(enrollment);
      if (result.status === "sent") {
        console.info("[send] sent", result.message);
      } else if (result.status === "failed") {
        console.error("[send] failed", result.message);
      } else if (result.status === "held") {
        console.info("[send] held", result.message);
      }
      return result;
    },
    {
      connection: createRedisConnection(),
      concurrency: Number(process.env.SEND_CONCURRENCY || 3),
    },
  );

  worker.on("failed", (job, error) => {
    console.error("[send] job failed", job?.id, error.message);
  });

  await sendQueue.upsertJobScheduler(
    "send-sweep",
    { every: sweepMs },
    { name: JOB_SWEEP, data: {} },
  );

  const recovered = await recoverPendingSendJobs();
  console.log(
    `[send] BullMQ worker up · sweep every ${sweepMs}ms · recovered ${recovered} job(s)`,
  );
}

export async function stopSendQueue() {
  await worker?.close();
}
