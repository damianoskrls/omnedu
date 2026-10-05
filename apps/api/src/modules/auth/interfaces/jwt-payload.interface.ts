export interface JwtPayload {
  sub: string;
  email: string;
  fullName: string;
  isSuperAdmin: boolean;
  schoolId: string | null;
  role: string | null;
  schoolLogoUrl?: string | null;
  schoolPrimaryColor?: string | null;
  memberships: { schoolId: string; schoolName: string; role: string }[];
}
