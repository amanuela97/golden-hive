import { Resend } from "resend";
import { config } from "dotenv";
config({ path: "./.env.local" });

const resend = new Resend(process.env.RESEND_API_KEY as string);

export default resend;
