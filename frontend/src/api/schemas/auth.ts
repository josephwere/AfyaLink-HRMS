import { z } from "zod";

export const LoginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const LoginResponse = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    role: z.string()
  })
});
