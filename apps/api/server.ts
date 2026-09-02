import app from "./src/app";
import http from "http";
import ConnectDB from "./src/db/ConnectDB";
import { startSendQueue } from "./src/queue/startSendQueue";

const server = http.createServer(app);
const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || "0.0.0.0";

ConnectDB()
  .then(async () => {
    await startSendQueue();
    server.listen(port, host, () => {
      console.log(`API running on ${host}:${port}`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
