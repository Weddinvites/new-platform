import { z } from "zod";

export const refreshSessionRequestSchema = z.object({
  refresh_token: z.string().min(1, "refresh_token is required"),
});

export type RefreshSessionRequestInput = z.infer<typeof refreshSessionRequestSchema>;
