export type UpdateOrganizationBrandingCommand = {
  readonly organizationId: string;
  readonly brandName?: string;
  readonly logo?: string;
  readonly primaryColor?: string;
  readonly secondaryColor?: string;
};
