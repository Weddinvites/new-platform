import { z } from "zod";

export const forgotPasswordRequestSchema = z.object({
  email: z.string().min(1, "email is required"),
});

export type ForgotPasswordRequestInput = z.infer<typeof forgotPasswordRequestSchema>;
