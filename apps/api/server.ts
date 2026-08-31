import app from "./src/app";
import http from "http";
import ConnectDB from "./src/db/ConnectDB";
import { APP_NAME } from "@furviou/shared";

const server = http.createServer(app);

/**
 * Connect to MongoDB and start the server and this server is the entry point of the application
 */
try {
  ConnectDB();
  server.listen(process.env.PORT || 4000, () => {
    console.log(`API running on port ${process.env.PORT || 4000}`);
  });
} catch (error) {
  console.error(error);
  process.exit(1);
}
