import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { Cookie, X, Settings } from "lucide-react";
import { Link } from "react-router-dom";

export type CookiePreferences = {
  necessary: true;
  analytics: boolean;
  preferences: boolean;
};

const COOKIE_KEY = "examly_cookie_consent";
const OPEN_EVENT = "examly:open-cookie-settings";

const defaultPrefs: CookiePreferences = {
  necessary: true,
  analytics: false,
  preferences: false,
};

// Radix dialogs expose role/data-state, but do not always set aria-modal.
// Keep pending consent out of both the viewport and tab order while another
// task owns the modal. Deferring does not save or imply a consent choice.
const hasOpenDialog = () => {
  if (typeof document === "undefined") return false;
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '[role="dialog"], [role="alertdialog"], dialog[open]',
    ),
  ).some((dialog) => {
    if (
      dialog.getAttribute("aria-modal") === "false" ||
      dialog.getAttribute("data-state") === "closed" ||
      dialog.closest('[hidden], [aria-hidden="true"]')
    )
      return false;
    const style = window.getComputedStyle(dialog);
    return style.display !== "none" && style.visibility !== "hidden";
  });
};

const readSaved = (): CookiePreferences => {
  if (typeof window === "undefined") return defaultPrefs;
  const saved = localStorage.getItem(COOKIE_KEY);
  if (!saved) return defaultPrefs;
  try {
    const parsed = JSON.parse(saved);
    return {
      necessary: true,
      analytics: !!parsed.analytics,
      preferences: !!parsed.preferences,
    };
  } catch {
    return defaultPrefs;
  }
};

/** Opens the cookie preferences modal from anywhere in the app. */
export const openCookieSettings = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
};

export const CookieConsent = () => {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [preferences, setPreferences] =
    useState<CookiePreferences>(defaultPrefs);
  const [dialogOpen, setDialogOpen] = useState(hasOpenDialog);

  useLayoutEffect(() => {
    if (!visible) return;
    const update = () => setDialogOpen(hasOpenDialog());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "role",
        "data-state",
        "aria-modal",
        "aria-hidden",
        "hidden",
        "open",
        "style",
        "class",
      ],
    });
    return () => observer.disconnect();
  }, [visible]);

  // First-visit auto-show
  useEffect(() => {
    const saved = localStorage.getItem(COOKIE_KEY);
    if (!saved) {
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
    setHasSaved(true);
    setPreferences(readSaved());
  }, []);

  // Listen for global "open settings" requests
  useEffect(() => {
    const handler = () => {
      if (!visible || !showDetails) {
        setPreferences(readSaved());
        setHasSaved(!!localStorage.getItem(COOKIE_KEY));
      }
      setShowDetails(true);
      setVisible(true);
    };
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, [visible, showDetails]);

  const savePreferences = useCallback((prefs: CookiePreferences) => {
    localStorage.setItem(
      COOKIE_KEY,
      JSON.stringify({ ...prefs, savedAt: new Date().toISOString() }),
    );
    setHasSaved(true);
    setVisible(false);
    setShowDetails(false);
  }, []);

  const acceptAll = () =>
    savePreferences({ necessary: true, analytics: true, preferences: true });

  const acceptNecessaryOnly = () =>
    savePreferences({ necessary: true, analytics: false, preferences: false });

  const saveCustom = () => savePreferences(preferences);

  if (!visible || dialogOpen) return null;

  const cookieRows: {
    key: keyof CookiePreferences;
    title: string;
    desc: string;
    locked: boolean;
    value: boolean;
  }[] = [
    {
      key: "necessary",
      title: "Strictly necessary",
      desc: "Required for login and core platform functionality. Cannot be disabled.",
      locked: true,
      value: true,
    },
    {
      key: "preferences",
      title: "Preference cookies",
      desc: "Remember your settings like theme preference (light/dark mode).",
      locked: false,
      value: preferences.preferences,
    },
    {
      key: "analytics",
      title: "Analytics cookies",
      desc: "Anonymised data that helps us understand how the platform is used and where to improve.",
      locked: false,
      value: preferences.analytics,
    },
  ];

  return (
    <>
      {showDetails && (
        <div
          onClick={() => setShowDetails(false)}
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[998]"
        />
      )}

      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-[999]">
        <div className="bg-card border border-border rounded-xl shadow-2xl p-5">
          {!showDetails ? (
            <>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Cookie className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground mb-1">
                    We use cookies
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We use cookies to keep you signed in and improve your
                    experience. We never use cookies for advertising.{" "}
                    <Link to="/privacy" className="text-primary underline">
                      Learn more
                    </Link>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={acceptAll}
                  className="flex-1 min-w-[110px] px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  Accept all
                </button>
                <button
                  onClick={acceptNecessaryOnly}
                  className="flex-1 min-w-[110px] px-3 py-2 rounded-md bg-transparent border border-border text-foreground text-xs font-medium hover:bg-muted transition-colors"
                >
                  Necessary only
                </button>
                <button
                  onClick={() => setShowDetails(true)}
                  className="px-3 py-2 rounded-md bg-transparent border border-border text-muted-foreground text-xs font-medium hover:bg-muted transition-colors inline-flex items-center gap-1.5"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Manage
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Cookie preferences
                </h3>
                <button
                  onClick={() => {
                    setShowDetails(false);
                    if (hasSaved) setVisible(false);
                  }}
                  className="text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer p-1"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 mb-4">
                {cookieRows.map((cookie) => (
                  <div
                    key={cookie.key}
                    className="flex items-start gap-3 p-3 rounded-md border border-border/60"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-foreground">
                          {cookie.title}
                        </span>
                        {cookie.locked && (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            Always on
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {cookie.desc}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (cookie.locked) return;
                        setPreferences((prev) => ({
                          ...prev,
                          [cookie.key]: !prev[cookie.key],
                        }));
                      }}
                      disabled={cookie.locked}
                      aria-label={`Toggle ${cookie.title}`}
                      className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors ${
                        cookie.value ? "bg-primary" : "bg-muted"
                      } ${cookie.locked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-card shadow-sm transition-transform ${
                          cookie.value
                            ? "translate-x-[22px]"
                            : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={saveCustom}
                  className="flex-1 px-3 py-2 rounded-md bg-transparent border border-border text-foreground text-xs font-medium hover:bg-muted transition-colors"
                >
                  Save preferences
                </button>
                <button
                  onClick={acceptAll}
                  className="flex-1 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  Accept all
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export const useCookieConsent = (): CookiePreferences => readSaved();

export const resetCookieConsent = () => {
  localStorage.removeItem(COOKIE_KEY);
};
