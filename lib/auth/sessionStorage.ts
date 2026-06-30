const REMEMBER_ME_KEY = "comeplayers_remember_me";

function hasBrowserStorage() {
  return typeof window !== "undefined";
}

export function getRememberMePreference() {
  if (!hasBrowserStorage()) return true;
  return window.localStorage.getItem(REMEMBER_ME_KEY) !== "false";
}

export function setRememberMePreference(remember: boolean) {
  if (!hasBrowserStorage()) return;
  window.localStorage.setItem(REMEMBER_ME_KEY, remember ? "true" : "false");
}

/**
 * Supabase storage adapter that switches between localStorage and
 * sessionStorage according to the latest Remember me preference.
 */
export const supabaseAuthStorage = {
  getItem(key: string) {
    if (!hasBrowserStorage()) return null;

    if (getRememberMePreference()) {
      return (
        window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)
      );
    }

    return (
      window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key)
    );
  },
  setItem(key: string, value: string) {
    if (!hasBrowserStorage()) return;

    if (getRememberMePreference()) {
      window.localStorage.setItem(key, value);
      window.sessionStorage.removeItem(key);
      return;
    }

    window.sessionStorage.setItem(key, value);
    window.localStorage.removeItem(key);
  },
  removeItem(key: string) {
    if (!hasBrowserStorage()) return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};
