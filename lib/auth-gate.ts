export function requireLoggedIn(
  userId: string | null | undefined,
  showAlert: (title: string, message: string) => void,
  t: (key: string) => string
): boolean {
  if (userId) return true;
  showAlert(t("auth.login_required_title"), t("auth.login_required_body"));
  return false;
}
