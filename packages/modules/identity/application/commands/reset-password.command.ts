export type ResetPasswordCommand = {
  email: string;
  token: string;
  newPassword: string;
};
