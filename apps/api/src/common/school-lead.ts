export function isSchoolLead(role?: string | null) {
  return role === 'school_admin' || role === 'owner';
}
