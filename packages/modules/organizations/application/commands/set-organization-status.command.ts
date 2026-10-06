export type SetOrganizationStatusCommand = {
  readonly organizationId: string;
  readonly status: "ACTIVE" | "SUSPENDED";
};
