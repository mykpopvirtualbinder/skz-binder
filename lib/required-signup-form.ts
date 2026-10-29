/** Cuenta cuyo alta se quedó a medias. Al entrar, tiene que terminar el formulario. */
export const SIGNUP_FORM_REQUIRED_USER_ID = "b9fcec07-710a-44cf-9a4d-8b93a4fbe856";

export function mustFinishSignupForm(profile: {
  id?: string | null;
  legal_consent?: boolean | null;
  birthdate?: string | null;
} | null): boolean {
  if (!profile || profile.id !== SIGNUP_FORM_REQUIRED_USER_ID) return false;
  return profile.legal_consent !== true || !profile.birthdate;
}
