import { z } from "zod";

export const UserSchema = z.object({
  _id: z.string(),
  email: z.string().email(),
  role: z.enum(["admin", "doctor", "patient"])
});