import React, { useEffect, useState } from "react";
import "../styles/pages.css";
import "../styles/profile.css";
import { getCurrentUser } from "../utils/api";
import { cacheUser, getCachedUser } from "../utils/userStorage";

const emptyProfile = Object.freeze({
  name: "—",
  role: "—",
  email: "—",
});

function formatProfile(user) {
  if (!user) return emptyProfile;
  return {
    name: user.username || user.name || emptyProfile.name,
    role: user.is_admin ? "Administrator" : "Member",
    email: user.email || emptyProfile.email,
  };
}

function Profile() {
  const cachedUser = getCachedUser();
  const [profile, setProfile] = useState(() => (cachedUser ? formatProfile(cachedUser) : emptyProfile));
  const [status, setStatus] = useState({ loading: !cachedUser, error: null });

  useEffect(() => {
    let isMounted = true;
    getCurrentUser()
      .then((response) => {
        if (!isMounted) return;
        if (response.ok && response.user) {
          cacheUser(response.user);
          setProfile(formatProfile(response.user));
          setStatus({ loading: false, error: null });
        } else {
          setStatus({ loading: false, error: response.message || "Unable to load profile." });
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setStatus({ loading: false, error: "Unable to connect to the server." });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="page profile-page">
      <header className="header">
        <h1 className="title">Profile</h1>
        
      </header>

      <div className="page__section profile__card profile__card--compact">
        <dl className="profile__details profile__details--stacked">
          <div>
            <dt>UserName</dt>
            <dd>{profile.name}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>
              {profile.role}
              {profile.role === "Administrator" && (
                <span className="profile__badge profile__badge--active" aria-label="Admin verified">
                  ✓
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{profile.email}</dd>
          </div>
        </dl>
        {status.loading && <p className="profile__status">Loading account details…</p>}
        {!status.loading && status.error && <p className="profile__status profile__status--error">{status.error}</p>}
      </div>
    </section>
  );
}

export default Profile;
