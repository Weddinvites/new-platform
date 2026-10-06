import { z } from "zod";

export const resetPasswordRequestSchema = z.object({
  email: z.string().min(1, "email is required"),
  token: z.string().min(1, "token is required"),
  password: z.string().min(1, "password is required"),
});

export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>;
