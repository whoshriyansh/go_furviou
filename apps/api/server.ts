import app from "./src/app";
import http from "http";
import ConnectDB from "./src/db/ConnectDB";
import { startSendWorker } from "./src/modules/campaigns/sendWorker";

const server = http.createServer(app);

ConnectDB()
  .then(() => {
    server.listen(process.env.PORT || 4000, () => {
      console.log(`API running on port ${process.env.PORT || 4000}`);
      startSendWorker();
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
