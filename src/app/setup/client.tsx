"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const HELP_STEPS = [
  {
    text: (
      <>
        Go to <span className="text-neutral-300">bandcamp.com</span> while
        logged in, open the browser menu and select More Tools &rarr; Developer
        Tools (or press F12)
      </>
    ),
    image: "/assets/screenshots/tutorial/open-dev-tools.png",
    alt: "Chrome menu showing More Tools then Developer Tools",
  },
  {
    text: (
      <>
        Go to the Application tab, expand Cookies &rarr; bandcamp.com in the
        sidebar, find the row named{" "}
        <code className="text-neutral-300">identity</code> and copy its Value
      </>
    ),
    image: "/assets/screenshots/tutorial/copy-identify-id.png",
    alt: "DevTools Application tab showing the identity cookie",
  },
];

export function SetupClient() {
  const router = useRouter();
  const [cookie, setCookie] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyConfigured, setAlreadyConfigured] = useState<boolean | null>(
    null,
  );
  const [showHelp, setShowHelp] = useState(false);
  const [helpStep, setHelpStep] = useState(0);

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((data) => setAlreadyConfigured(data.configured));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cookie: cookie.trim(),
          username: username.trim(),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/sync");
    } catch {
      setError("Network error. Is the dev server running?");
    } finally {
      setSubmitting(false);
    }
  }

  function openHelp() {
    setHelpStep(0);
    setShowHelp(true);
  }

  const step = HELP_STEPS[helpStep];
  const isFirst = helpStep === 0;
  const isLast = helpStep === HELP_STEPS.length - 1;

  return (
    <div className="max-w-2xl mx-auto py-12">
      {/* Already configured banner */}
      {alreadyConfigured && (
        <div className="mb-6 rounded border border-neutral-700 bg-neutral-900/80 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Account already set up</p>
            <p className="text-xs text-neutral-400 mt-0.5">
              You can manage your connection in Settings, or re-enter
              credentials below to overwrite.
            </p>
          </div>
          <button
            onClick={() => router.push("/settings")}
            className="rounded border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800 shrink-0 ml-4"
          >
            Go to Settings
          </button>
        </div>
      )}

      <h1 className="text-2xl font-semibold tracking-tight mb-2">Setup</h1>
      <p className="text-sm text-neutral-400 mb-8">
        Connect your Bandcamp account to start syncing. You&apos;ll need your
        Bandcamp username and a session cookie from your browser.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Username */}
        <div className="rounded border border-neutral-800 p-6 bg-neutral-900/50">
          <label htmlFor="username" className="block text-sm font-medium mb-1">
            Bandcamp username
          </label>
          <p className="text-xs text-neutral-500 mb-3">
            The username from your profile URL:{" "}
            <span className="text-neutral-300">
              bandcamp.com/<em>your-username</em>
            </span>
          </p>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your-username"
            required
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
          />
        </div>

        {/* Identity cookie */}
        <div className="rounded border border-neutral-800 p-6 bg-neutral-900/50">
          <div className="flex items-center gap-2 mb-1">
            <label htmlFor="cookie" className="block text-sm font-medium">
              Identity cookie
            </label>
            <button
              type="button"
              onClick={openHelp}
              className="w-5 h-5 rounded-full border border-neutral-600 text-neutral-400 text-xs flex items-center justify-center hover:border-neutral-400 hover:text-white"
              aria-label="How to find the identity cookie"
            >
              ?
            </button>
          </div>
          <p className="text-xs text-neutral-500 mb-3">
            Open <span className="text-neutral-300">bandcamp.com</span> while
            logged in. Open DevTools (F12) &rarr; Application &rarr; Cookies
            &rarr; bandcamp.com, and copy the value of the{" "}
            <code className="text-neutral-300">identity</code> cookie.
          </p>
          <input
            id="cookie"
            type="text"
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
            placeholder="Paste your identity cookie here"
            required
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !cookie.trim() || !username.trim()}
          className="rounded bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Validating..." : "Connect & start syncing"}
        </button>
      </form>

      {/* Help modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-6 max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 className="text-lg font-semibold">
                How to find the identity cookie
              </h3>
              <button
                onClick={() => setShowHelp(false)}
                className="text-neutral-400 hover:text-white text-xl leading-none"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            {/* Step content */}
            <div className="flex-1 min-h-0 flex flex-col">
              <p className="text-sm font-medium mb-3 shrink-0">
                Step {helpStep + 1} of {HELP_STEPS.length}:{" "}
                {step.text}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={step.image}
                alt={step.alt}
                className="rounded border border-neutral-700 w-full object-contain min-h-0"
              />
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-800">
              <button
                onClick={() => setHelpStep((s) => s - 1)}
                disabled={isFirst}
                className="flex items-center gap-1 text-sm text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-neutral-400"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
                    clipRule="evenodd"
                  />
                </svg>
                Previous
              </button>

              {isLast ? (
                <button
                  onClick={() => setShowHelp(false)}
                  className="rounded bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-sm font-medium"
                >
                  Got it
                </button>
              ) : (
                <button
                  onClick={() => setHelpStep((s) => s + 1)}
                  className="flex items-center gap-1 text-sm text-neutral-400 hover:text-white"
                >
                  Next
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
