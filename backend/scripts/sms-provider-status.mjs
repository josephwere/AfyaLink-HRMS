import "../config/loadEnv.js";
import { getSmsProviderStatus } from "../services/notificationService.js";

console.log(JSON.stringify(getSmsProviderStatus(), null, 2));
