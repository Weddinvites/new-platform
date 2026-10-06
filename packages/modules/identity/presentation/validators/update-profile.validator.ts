import { z } from "zod";

export const updateProfileRequestSchema = z.object({
  full_name: z.string().min(1, "full_name is required"),
});

export type UpdateProfileRequestInput = z.infer<typeof updateProfileRequestSchema>;
