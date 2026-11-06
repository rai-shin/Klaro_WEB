
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserX,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogOut,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

type UserRole = "ADMIN" | "USER";

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
};

export default function AdminUsersPage() {
  const router = useRouter();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/users", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load user accounts.");
      }

      setUsers(data.users ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
  queueMicrotask(() => {
    void loadUsers();
  });
}, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return users;

    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.role.toLowerCase().includes(term)
    );
  }, [users, search]);

  const activeCount = users.filter((user) => user.isActive).length;
  const pendingCount = users.filter((user) => !user.isActive).length;
  const adminCount = users.filter(
    (user) => user.role === "ADMIN" && user.isActive
  ).length;

  async function handleLogout() {
    if (isLoggingOut) return;

    const confirmed = window.confirm(
      "Are you sure you want to log out of the administrator account?"
    );

    if (!confirmed) return;

    setIsLoggingOut(true);
    setError("");
    setNotice("");

    try {
      const { error: logoutError } = await authClient.signOut();

      if (logoutError) {
        throw new Error(
          logoutError.message || "Unable to sign out."
        );
      }

      router.replace("/auth");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while signing out."
      );
      setIsLoggingOut(false);
    }
  }

  async function updateUser(
    user: ManagedUser,
    changes: { role?: UserRole; isActive?: boolean }
  ) {
    const actionDescription =
      changes.isActive === true
        ? "activate"
        : changes.isActive === false
          ? "deactivate"
          : changes.role === "ADMIN"
            ? "promote this account to administrator"
            : "change this account to a regular user";

    if (
      !window.confirm(
        `Are you sure you want to ${actionDescription} for ${user.name} (${user.email})?`
      )
    ) {
      return;
    }

    setUpdatingId(user.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(changes),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update this account.");
      }

      setUsers((currentUsers) =>
        currentUsers.map((item) =>
          item.id === user.id ? data.user : item
        )
      );

      setNotice(data.message || "Account updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(date));
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page heading */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700">
              <ShieldCheck size={17} />
              System Administration
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              User Management
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage registered accounts, access permissions, and account
              activation.
            </p>
          </div>

          {/* Page actions */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void loadUsers()}
              disabled={loading || isLoggingOut}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
              Refresh accounts
            </button>

            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingOut ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <LogOut size={16} />
              )}
              {isLoggingOut ? "Signing out..." : "Logout"}
            </button>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {notice && (
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            <p>{notice}</p>
          </div>
        )}

        {/* Summary cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total accounts"
            value={users.length}
            icon={<Users size={21} />}
            color="blue"
          />

          <SummaryCard
            title="Active accounts"
            value={activeCount}
            icon={<UserCheck size={21} />}
            color="green"
          />

          <SummaryCard
            title="Pending activation"
            value={pendingCount}
            icon={<Clock size={21} />}
            color="amber"
          />

          <SummaryCard
            title="Active administrators"
            value={adminCount}
            icon={<ShieldCheck size={21} />}
            color="purple"
          />
        </section>

        {/* User list */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Registered accounts
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Review and manage access to Klaro.
              </p>
            </div>

            <div className="relative w-full sm:max-w-xs">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, or role..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-500">
              <Loader2 size={20} className="animate-spin text-blue-600" />
              Loading accounts...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 rounded-full bg-slate-100 p-4 text-slate-400">
                <Users size={27} />
              </div>
              <h3 className="font-semibold text-slate-800">
                {search ? "No matching accounts" : "No accounts found"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {search
                  ? "Try searching with another name, email, or role."
                  : "Registered accounts will appear here."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-semibold">User</th>
                      <th className="px-6 py-4 font-semibold">Role</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Registered</th>
                      <th className="px-6 py-4 text-right font-semibold">
                        Account actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">
                            {user.name}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {user.email}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <select
                            value={user.role}
                            disabled={updatingId === user.id}
                            onChange={(event) =>
                              void updateUser(user, {
                                role: event.target.value as UserRole,
                              })
                            }
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400 disabled:opacity-50"
                          >
                            <option value="USER">User</option>
                            <option value="ADMIN">Administrator</option>
                          </select>
                        </td>

                        <td className="px-6 py-4">
                          <StatusBadge active={user.isActive} />
                        </td>

                        <td className="whitespace-nowrap px-6 py-4 text-slate-500">
                          {formatDate(user.createdAt)}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            disabled={updatingId === user.id}
                            onClick={() =>
                              void updateUser(user, {
                                isActive: !user.isActive,
                              })
                            }
                            className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              user.isActive
                                ? "bg-red-50 text-red-700 hover:bg-red-100"
                                : "bg-green-50 text-green-700 hover:bg-green-100"
                            }`}
                          >
                            {updatingId === user.id ? (
                              <Loader2
                                size={14}
                                className="animate-spin"
                              />
                            ) : user.isActive ? (
                              <UserX size={14} />
                            ) : (
                              <UserCheck size={14} />
                            )}

                            {user.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 p-4 md:hidden">
                {filteredUsers.map((user) => (
                  <article
                    key={user.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-slate-900">
                          {user.name}
                        </h3>
                        <p className="mt-1 break-all text-xs text-slate-500">
                          {user.email}
                        </p>
                      </div>

                      <StatusBadge active={user.isActive} />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor={`role-${user.id}`}
                          className="mb-1.5 block text-xs font-medium text-slate-500"
                        >
                          Account role
                        </label>

                        <select
                          id={`role-${user.id}`}
                          value={user.role}
                          disabled={updatingId === user.id}
                          onChange={(event) =>
                            void updateUser(user, {
                              role: event.target.value as UserRole,
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                        >
                          <option value="USER">User</option>
                          <option value="ADMIN">Administrator</option>
                        </select>
                      </div>

                      <div>
                        <span className="mb-1.5 block text-xs font-medium text-slate-500">
                          Registered
                        </span>
                        <p className="py-2 text-xs text-slate-700">
                          {formatDate(user.createdAt)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={updatingId === user.id}
                      onClick={() =>
                        void updateUser(user, {
                          isActive: !user.isActive,
                        })
                      }
                      className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                        user.isActive
                          ? "bg-red-50 text-red-700 hover:bg-red-100"
                          : "bg-green-50 text-green-700 hover:bg-green-100"
                      }`}
                    >
                      {updatingId === user.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : user.isActive ? (
                        <UserX size={16} />
                      ) : (
                        <UserCheck size={16} />
                      )}

                      {user.isActive
                        ? "Deactivate account"
                        : "Activate account"}
                    </button>
                  </article>
                ))}
              </div>

              <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                Showing {filteredUsers.length} of {users.length} accounts
              </div>
            </>
          )}
        </section>

        <p className="text-xs leading-relaxed text-slate-400">
          Account management is restricted to active administrators. Passwords
          and authentication credentials are not displayed or accessible from
          this page.
        </p>
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: "blue" | "green" | "amber" | "purple";
}) {
  const styles = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    purple: "bg-purple-50 text-purple-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={`rounded-xl p-2.5 ${styles[color]}`}>
          {icon}
        </div>
      </div>

      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? "bg-green-50 text-green-700"
          : "bg-amber-50 text-amber-700"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-green-500" : "bg-amber-500"
        }`}
      />
      {active ? "Active" : "Pending"}
    </span>
  );
}
