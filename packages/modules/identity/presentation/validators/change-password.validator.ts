import { z } from "zod";

export const changePasswordRequestSchema = z.object({
  current_password: z.string().min(1, "current_password is required"),
  new_password: z.string().min(1, "new_password is required"),
});

export type ChangePasswordRequestInput = z.infer<typeof changePasswordRequestSchema>;
