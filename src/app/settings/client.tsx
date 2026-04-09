"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AccountInfo {
  configured: boolean;
  username: string | null;
}

export function SettingsClient() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountInfo | null>(null);

  // Cookie update
  const [newCookie, setNewCookie] = useState("");
  const [cookieError, setCookieError] = useState<string | null>(null);
  const [cookieSuccess, setCookieSuccess] = useState(false);
  const [updatingCookie, setUpdatingCookie] = useState(false);

  // Account change modal
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setAccount);
  }, []);

  async function handleUpdateCookie(e: React.FormEvent) {
    e.preventDefault();
    setCookieError(null);
    setCookieSuccess(false);
    setUpdatingCookie(true);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cookie: newCookie.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setCookieError(data.error);
        return;
      }
      setCookieSuccess(true);
      setNewCookie("");
    } catch {
      setCookieError("Network error.");
    } finally {
      setUpdatingCookie(false);
    }
  }

  async function handleChangeAccount() {
    setChanging(true);
    try {
      const res = await fetch("/api/settings", { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        router.push("/setup");
      }
    } catch {
      // best-effort
    } finally {
      setChanging(false);
    }
  }

  if (!account) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    );
  }

  if (!account.configured) {
    router.push("/setup");
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto py-12">
      <h1 className="text-2xl font-semibold tracking-tight mb-2">Settings</h1>
      <p className="text-sm text-neutral-400 mb-8">
        Manage your Bandcamp connection.
      </p>

      {/* Current account */}
      <div className="rounded border border-neutral-800 p-6 bg-neutral-900/50 mb-6">
        <h2 className="text-sm font-medium mb-3">Account</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-neutral-500">Username</dt>
          <dd>{account.username ?? "—"}</dd>
        </dl>
      </div>

      {/* Update cookie */}
      <div className="rounded border border-neutral-800 p-6 bg-neutral-900/50 mb-6">
        <h2 className="text-sm font-medium mb-1">Update cookie</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Bandcamp session cookies expire over time. When syncing stops working,
          grab a fresh{" "}
          <code className="text-neutral-300">identity</code> cookie from
          DevTools and paste it here.
        </p>
        <form onSubmit={handleUpdateCookie} className="flex gap-3">
          <input
            type="text"
            value={newCookie}
            onChange={(e) => {
              setNewCookie(e.target.value);
              setCookieSuccess(false);
              setCookieError(null);
            }}
            placeholder="Paste new identity cookie"
            className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
          />
          <button
            type="submit"
            disabled={updatingCookie || !newCookie.trim()}
            className="rounded border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updatingCookie ? "Validating..." : "Update"}
          </button>
        </form>
        {cookieError && (
          <p className="mt-2 text-sm text-red-400">{cookieError}</p>
        )}
        {cookieSuccess && (
          <p className="mt-2 text-sm text-green-400">Cookie updated.</p>
        )}
      </div>

      {/* Change account */}
      <div className="rounded border border-neutral-800 p-6 bg-neutral-900/50">
        <h2 className="text-sm font-medium mb-1">Change account</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Switch to a different Bandcamp account. This will delete all synced
          data and start fresh.
        </p>
        <button
          onClick={() => setShowChangeModal(true)}
          className="rounded border border-red-800 text-red-400 px-3 py-2 text-sm hover:bg-red-950"
        >
          Change account...
        </button>
      </div>

      {/* Confirmation modal */}
      {showChangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Change account?</h3>
            <p className="text-sm text-neutral-400 mb-6">
              This will permanently delete all synced artists, releases, and
              tags. You&apos;ll need to set up and sync again from scratch.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowChangeModal(false)}
                className="rounded border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeAccount}
                disabled={changing}
                className="rounded bg-red-600 hover:bg-red-500 px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                {changing ? "Deleting..." : "Delete data & change account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
