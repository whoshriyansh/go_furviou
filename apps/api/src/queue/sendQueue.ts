import IORedis from "ioredis";
import { Queue, type JobsOptions } from "bullmq";
import Campaign from "../models/campaign";
import CampaignLead from "../models/campaignLead";

export const SEND_QUEUE_NAME = "furviou-send";
export const JOB_SEND = "send-enrollment";
export const JOB_SWEEP = "sweep-due";

export type SendJobData = {
  campaignLeadId: string;
  ignoreWindow?: boolean;
};

function redisUrl() {
  return process.env.REDIS_URL || "redis://127.0.0.1:6379";
}

export function createRedisConnection() {
  return new IORedis(redisUrl(), {
    maxRetriesPerRequest: null,
  });
}

const connection = createRedisConnection();

export async function pingRedis() {
  return connection.ping();
}

export const sendQueue = new Queue(SEND_QUEUE_NAME, { connection });

export function sendJobId(campaignLeadId: string) {
  // BullMQ forbids ":" in custom job IDs (used as a Redis key separator).
  return `send-${campaignLeadId}`;
}

const jobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 20000 },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 500 },
};

export async function removeSendJob(campaignLeadId: string) {
  const job = await sendQueue.getJob(sendJobId(campaignLeadId));
  if (!job) {
    return;
  }
  const state = await job.getState();
  if (state === "active") {
    return;
  }
  await job.remove().catch(() => undefined);
}

export async function scheduleSendJob(
  campaignLeadId: string,
  when: Date,
  options?: { ignoreWindow?: boolean },
) {
  const jobId = sendJobId(campaignLeadId);
  const delay = Math.max(0, when.getTime() - Date.now());
  const data: SendJobData = {
    campaignLeadId,
    ignoreWindow: Boolean(options?.ignoreWindow),
  };

  const existing = await sendQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state === "active") {
      return;
    }
    if (state === "delayed" || state === "waiting") {
      await existing.updateData(data);
      await existing.changeDelay(delay);
      return;
    }
    await existing.remove().catch(() => undefined);
  }

  await sendQueue.add(JOB_SEND, data, { ...jobOptions, jobId, delay });
}

export async function syncEnrollmentJob(enrollment: {
  _id: { toString(): string };
  status: string;
  nextSendAt?: Date | null;
} | null) {
  if (!enrollment) {
    return;
  }

  const terminal = new Set([
    "completed",
    "failed",
    "bounced",
    "unsubscribed",
    "replied",
    "paused",
  ]);

  if (terminal.has(enrollment.status) || !enrollment.nextSendAt) {
    await removeSendJob(String(enrollment._id));
    return;
  }

  await scheduleSendJob(String(enrollment._id), enrollment.nextSendAt);
}

export async function syncEnrollmentJobs(
  enrollments: Array<{
    _id: { toString(): string };
    status: string;
    nextSendAt?: Date | null;
  }>,
) {
  for (const enrollment of enrollments) {
    await syncEnrollmentJob(enrollment);
  }
}

export async function enqueueDueSends() {
  const due = await CampaignLead.find({
    status: { $in: ["queued", "active"] },
    nextSendAt: { $lte: new Date() },
  })
    .sort({ nextSendAt: 1 })
    .limit(50)
    .select("_id campaignId nextSendAt status");

  let queued = 0;
  for (const row of due) {
    const campaign = await Campaign.findById(row.campaignId).select("status");
    if (campaign?.status !== "active") {
      continue;
    }
    await scheduleSendJob(String(row._id), row.nextSendAt || new Date());
    queued += 1;
  }
  return queued;
}

export async function recoverPendingSendJobs() {
  const pending = await CampaignLead.find({
    status: { $in: ["queued", "active"] },
    nextSendAt: { $exists: true, $ne: null },
  }).select("_id status nextSendAt");

  await syncEnrollmentJobs(pending);
  return pending.length;
}

export async function getQueueCounts() {
  return sendQueue.getJobCounts(
    "wait",
    "delayed",
    "active",
    "completed",
    "failed",
  );
}
