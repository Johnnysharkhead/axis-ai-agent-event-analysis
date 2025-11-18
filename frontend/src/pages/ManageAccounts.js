import React, { useEffect, useState } from "react";
import { fetchAllUsers, getCurrentUser, updateUserAdmin, updateUserBlock } from "../utils/api";
import { cacheUser } from "../utils/userStorage";
import "../styles/pages.css";
import "../styles/manageAccounts.css";

function ManageAccounts() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState(null);

  const isPending = (userId, action) =>
    pendingAction?.id === userId && pendingAction?.action === action;

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setLoading(true);
      setError("");

      const me = await getCurrentUser();
      if (!me?.ok || !me.user?.is_admin) {
        if (!cancelled) {
          setError("You need admin access to view this page.");
          setUsers([]);
          setLoading(false);
        }
        return;
      }

      cacheUser(me.user);

      const response = await fetchAllUsers();
      if (!cancelled) {
        if (response.ok) {
          setUsers(response.users || []);
        } else {
          setError(response.message || "Failed to load users.");
        }
        setLoading(false);
      }
    }

    loadUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  const renderBody = () => {
    if (loading) {
      return (
        <tr>
          <td colSpan="6" className="manage-accounts__status">
            Loading users…
          </td>
        </tr>
      );
    }

    if (error) {
      return (
        <tr>
          <td colSpan="6" className="manage-accounts__status manage-accounts__status--error">
            {error}
          </td>
        </tr>
      );
    }

    if (!users.length) {
      return (
        <tr>
          <td colSpan="6" className="manage-accounts__status">
            No users found.
          </td>
        </tr>
      );
    }

    return users.map((user) => (
      <tr key={user.id}>
        <td>{user.username}</td>
        <td>{user.email}</td>
        <td>
          <span className={user.is_admin ? "manage-accounts__badge manage-accounts__badge--admin" : "manage-accounts__badge"}>
            {user.is_admin ? "Admin" : "Member"}
          </span>
        </td>
        <td>
          <span
            className={
              user.is_blocked
                ? "manage-accounts__badge manage-accounts__badge--blocked"
                : "manage-accounts__badge manage-accounts__badge--active"
            }
          >
            {user.is_blocked ? "Blocked" : "Active"}
          </span>
        </td>
        <td>{user.failed_login_attempts ?? 0}</td>
        <td className="manage-accounts__actions">
          <button
            type="button"
            className="manage-accounts__action"
            disabled={isPending(user.id, "admin")}
            onClick={() => handleToggleAdmin(user)}
          >
            {isPending(user.id, "admin")
              ? "Saving..."
              : user.is_admin
              ? "Revoke admin"
              : "Make admin"}
          </button>
          <button
            type="button"
            className={`manage-accounts__action${user.is_blocked ? " manage-accounts__action--danger" : ""}`}
            disabled={isPending(user.id, "block")}
            onClick={() => handleToggleBlock(user)}
          >
            {isPending(user.id, "block")
              ? "Saving..."
              : user.is_blocked
              ? "Unblock user"
              : "Block user"}
          </button>
          <button
            type="button"
            className="manage-accounts__action"
            disabled={isPending(user.id, "reset")}
            onClick={() => handleResetFailedAttempts(user)}
          >
            {isPending(user.id, "reset") ? "Resetting…" : "Reset failed logins"}
          </button>
        </td>
      </tr>
    ));
  };

  const handleToggleAdmin = async (user) => {
    setPendingAction({ id: user.id, action: "admin" });
    setError("");
    const response = await updateUserAdmin(user.id, !user.is_admin);
    if (response.ok && response.user) {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, ...response.user } : u))
      );
    } else {
      setError(response.message || "Failed to update admin status.");
    }
    setPendingAction(null);
  };

  const handleToggleBlock = async (user) => {
    setPendingAction({ id: user.id, action: "block" });
    setError("");
    const response = await updateUserBlock(user.id, {
      isBlocked: !user.is_blocked,
      resetFailedAttempts: !user.is_blocked
    });
    if (response.ok && response.user) {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, ...response.user } : u))
      );
    } else {
      setError(response.message || "Failed to update block status.");
    }
    setPendingAction(null);
  };

  const handleResetFailedAttempts = async (user) => {
    setPendingAction({ id: user.id, action: "reset" });
    setError("");
    const response = await updateUserBlock(user.id, {
      resetFailedAttempts: true
    });
    if (response.ok && response.user) {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, ...response.user } : u))
      );
    } else {
      setError(response.message || "Failed to reset failed logins.");
    }
    setPendingAction(null);
  };

  return (
    <section className="page">
      <div className="page__top-bar">
        <header className="header">
          <h1 className="title">Manage Accounts</h1>
          <p className="subtitle">View every registered user and manage roles, account status, and failed login attempts.</p>
        </header>
      </div>

      <div className="page__section page__section--flush manage-accounts__card">
        <div className="manage-accounts__table-wrapper">
          <table className="manage-accounts__table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Failed logins</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>{renderBody()}</tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default ManageAccounts;
