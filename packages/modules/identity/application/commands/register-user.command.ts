export type RegisterUserCommand = {
  email: string;
  password: string;
  fullName: string;
  invitationToken?: string;
};
