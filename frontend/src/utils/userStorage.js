const USER_STORAGE_KEY = "axisCurrentUser";

export function cacheUser(user) {
  try {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    }
  } catch (error) {
    console.warn("Unable to cache user", error);
  }
}

export function getCachedUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Unable to read cached user", error);
    return null;
  }
}

export function clearCachedUser() {
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch (error) {
    console.warn("Unable to clear cached user", error);
  }
}

export function userIsAdmin() {
  const user = getCachedUser();
  return Boolean(user?.is_admin);
}
