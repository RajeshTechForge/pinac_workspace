import {
  useState,
  useRef,
  useMemo,
  useEffect,
  type ChangeEvent,
  type ReactElement,
} from "react";
import { User, Upload, Trash2, CheckCircle, AlertCircle } from "lucide-react";
import { useChatContext } from "../../context/ChatContext";
import { useAuth } from "../../context/AuthContext";

/** Maximum allowed avatar file size in bytes (2 MB). */
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;

/** Allowed MIME types for uploaded profile images. */
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

/**
 * Derives user avatar initials from first and last names, falling back to
 * email or a default single letter.
 */
function deriveInitials(
  firstName: string,
  lastName: string,
  email: string,
): string {
  const firstInitial = firstName.trim().charAt(0).toUpperCase();
  const lastInitial = lastName.trim().charAt(0).toUpperCase();

  if (firstInitial && lastInitial) {
    return `${firstInitial}${lastInitial}`;
  }
  if (firstInitial) {
    return firstInitial;
  }
  if (lastInitial) {
    return lastInitial;
  }
  if (email.trim()) {
    return email.trim().charAt(0).toUpperCase();
  }
  return "U";
}

/**
 * ProfileTab settings panel component.
 *
 * Provides controls for configuring user identity:
 * - Profile picture (avatar preview, file upload with size validation, removal)
 * - First and Last name inputs (replacing monolithic display name)
 * - Email address
 *
 * Synchronizes with ChatContext settings and pre-populates with authenticated
 * session details when available.
 */
export default function ProfileTab(): ReactElement {
  const { state, dispatch } = useChatContext();
  const { status } = useAuth();

  const authUser = status.kind === "authenticated" ? status.user : null;

  // Initialize fields with local settings, falling back to authenticated WorkOS user.
  const [firstName, setFirstName] = useState(
    () => state.settings.firstName || (authUser?.firstName ?? ""),
  );
  const [lastName, setLastName] = useState(
    () => state.settings.lastName || (authUser?.lastName ?? ""),
  );
  const [email, setEmail] = useState(
    () => state.settings.email || (authUser?.email ?? ""),
  );
  const [avatarUrl, setAvatarUrl] = useState(
    () => state.settings.avatarUrl || (authUser?.profilePictureUrl ?? ""),
  );

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronize state when authenticated user data becomes available after initial render.
  useEffect(() => {
    if (!authUser) return;

    if (authUser.firstName && !state.settings.firstName) {
      setFirstName((current) => current || authUser.firstName || "");
    }
    if (authUser.lastName && !state.settings.lastName) {
      setLastName((current) => current || authUser.lastName || "");
    }
    if (authUser.email && !state.settings.email) {
      setEmail((current) => current || authUser.email || "");
    }
    if (authUser.profilePictureUrl && !state.settings.avatarUrl) {
      setAvatarUrl((current) => current || authUser.profilePictureUrl || "");
    }
  }, [
    authUser,
    state.settings.firstName,
    state.settings.lastName,
    state.settings.email,
    state.settings.avatarUrl,
  ]);

  // Clean up feedback timeout on unmount to avoid memory leaks.
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current !== null) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const initials = useMemo(
    () => deriveInitials(firstName, lastName, email),
    [firstName, lastName, email],
  );

  const hasChanges =
    firstName !== (state.settings.firstName || (authUser?.firstName ?? "")) ||
    lastName !== (state.settings.lastName || (authUser?.lastName ?? "")) ||
    email !== (state.settings.email || (authUser?.email ?? "")) ||
    avatarUrl !==
      (state.settings.avatarUrl || (authUser?.profilePictureUrl ?? ""));

  /** Trigger hidden file picker input. */
  function handleTriggerFileInput(): void {
    setUploadError(null);
    fileInputRef.current?.click();
  }

  /** Handle file selection from local device with validation. */
  function handleFileChange(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    // Reset file input value so selecting the same file again triggers change event.
    e.target.value = "";

    if (!file) {
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setUploadError("Please select a valid image (PNG, JPEG, WebP, or GIF).");
      return;
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setUploadError("Image size must be smaller than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
        setUploadError(null);
      }
    };
    reader.onerror = () => {
      setUploadError("Failed to read image file. Please try again.");
    };
    reader.readAsDataURL(file);
  }

  /** Remove the customized profile picture and return to fallback initials. */
  function handleRemoveAvatar(): void {
    setAvatarUrl("");
    setUploadError(null);
  }

  /** Persist the updated profile details to ChatContext. */
  function handleSave(): void {
    const derivedDisplayName =
      [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || "User";

    dispatch({
      type: "UPDATE_SETTINGS",
      payload: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: derivedDisplayName,
        email: email.trim(),
        avatarUrl,
      },
    });

    setIsSaved(true);
    if (feedbackTimeoutRef.current !== null) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = setTimeout(() => {
      setIsSaved(false);
    }, 2000);
  }

  return (
    <div className="max-w-md space-y-6">
      {/* Profile Picture Section */}
      <div>
        <label className="block text-xs font-ui text-text-secondary mb-2.5">
          Profile Picture
        </label>
        <div className="flex items-center gap-4">
          {/* Avatar Preview Box */}
          <div className="relative w-16 h-16 rounded-md bg-surface-2 border border-border flex items-center justify-center overflow-hidden shrink-0 shadow-inner group">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile avatar"
                className="w-full h-full object-cover"
              />
            ) : initials ? (
              <span className="text-base font-mono font-medium text-text-primary">
                {initials}
              </span>
            ) : (
              <User size={24} className="text-text-muted" aria-hidden />
            )}
          </div>

          {/* Action buttons and guidelines */}
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
                aria-label="Upload profile picture"
              />
              <button
                type="button"
                onClick={handleTriggerFileInput}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-ui bg-surface-2 border border-border hover:bg-surface-3 hover:text-text-primary text-text-secondary rounded-sm transition-colors duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 cursor-pointer"
              >
                <Upload size={12} aria-hidden />
                {avatarUrl ? "Change" : "Upload"}
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-ui bg-transparent hover:bg-surface-2 text-text-muted hover:text-red-400 rounded-sm transition-colors duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 cursor-pointer"
                >
                  <Trash2 size={12} aria-hidden />
                  Remove
                </button>
              )}
            </div>

            <p className="text-[11px] font-ui text-text-muted">
              JPG, PNG, WebP or GIF. Max size 2MB.
            </p>
          </div>
        </div>

        {/* Upload error banner */}
        {uploadError && (
          <div
            role="alert"
            className="mt-2.5 flex items-center gap-1.5 text-xs font-ui text-red-400 bg-red-950/20 border border-red-900/30 rounded-sm px-2.5 py-1.5"
          >
            <AlertCircle size={13} className="shrink-0" aria-hidden />
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      {/* Name Section: First Name and Last Name in 2 columns */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="profile-first-name"
            className="block text-xs font-ui text-text-secondary mb-1.5"
          >
            First Name
          </label>
          <input
            id="profile-first-name"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-sm px-3 py-1.5 text-sm text-text-primary font-ui placeholder-text-muted outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors duration-100"
            placeholder="First name"
            autoComplete="given-name"
          />
        </div>

        <div>
          <label
            htmlFor="profile-last-name"
            className="block text-xs font-ui text-text-secondary mb-1.5"
          >
            Last Name
          </label>
          <input
            id="profile-last-name"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-sm px-3 py-1.5 text-sm text-text-primary font-ui placeholder-text-muted outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors duration-100"
            placeholder="Last name"
            autoComplete="family-name"
          />
        </div>
      </div>

      {/* Email Section */}
      <div>
        <label
          htmlFor="profile-email"
          className="block text-xs font-ui text-text-secondary mb-1.5"
        >
          Email
        </label>
        <input
          id="profile-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-sm px-3 py-1.5 text-sm text-text-primary font-ui placeholder-text-muted outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors duration-100"
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>

      {/* Footer / Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges}
          className="px-4 py-1.5 text-xs font-ui font-medium bg-accent text-white rounded-sm hover:bg-accent-dim transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
        >
          Save Changes
        </button>

        {isSaved && (
          <span className="flex items-center gap-1 text-xs font-ui text-emerald-400 animate-fade-in">
            <CheckCircle size={13} aria-hidden />
            Changes saved
          </span>
        )}
      </div>
    </div>
  );
}
