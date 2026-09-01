/**
 * Invite completion must not attach an existing tenant user to another company.
 * Users with no company_id yet (fresh invite registration) are allowed.
 */
export function inviteUserCompanyAllowed(
  userCompanyId: string | null | undefined,
  inviteCompanyId: string
): boolean {
  if (!userCompanyId) return true;
  return userCompanyId === inviteCompanyId;
}
