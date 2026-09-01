export type AuthUser = {
  id: string;
  email: string;
  displayName?: string;
  avatar?: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};
