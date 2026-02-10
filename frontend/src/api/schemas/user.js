// frontend/src/api/schemas/user.js
import { z } from "zod";

export const UserSchema = z.object({
  _id: z.string(),
  email: z.string().email(),
  role: z.enum([
    "SUPER_ADMIN",
    "HOSPITAL_ADMIN",
    "DOCTOR",
    "NURSE",
    "LAB_TECH",
    "PHARMACIST",
    "SECURITY_OFFICER",
    "SECURITY_ADMIN",
    "PATIENT",
    "GUEST",
  ]),
});
