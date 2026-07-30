import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import app from "./app";
import { logger } from "./lib/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, ".env") });

const PORT = parseInt(process.env.PORT || "8080", 10);

app.listen(PORT, () => {
  logger.info(`EarningsEdge API server listening on port ${PORT}`);
});
