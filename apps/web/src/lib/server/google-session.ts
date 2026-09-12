export type GoogleSession = {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
  email: string;
  name: string;
};
