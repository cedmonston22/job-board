import { cn } from "@/lib/utils";

// Profile avatar — shows the user's Google profile image when available,
// otherwise a colored circle with their initial. Server component (no hooks),
// so it can be rendered anywhere including inside other server components.
//
// We use a plain <img> instead of next/image because Google's profile image
// URLs live on `lh3.googleusercontent.com` and using next/image would require
// adding that to `next.config.js` remotePatterns. The image is small (avatar
// size), so the optimization next/image would provide is negligible.
export function Avatar({
  src,
  name,
  email,
  size = "default",
  className,
}: {
  src: string | null | undefined;
  name: string | null | undefined;
  email: string;
  size?: "default" | "lg";
  className?: string;
}) {
  const sizeClass = size === "lg" ? "size-16 text-xl" : "size-8 text-sm";

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        // Google's lh3.googleusercontent.com refuses requests with an unknown
        // Referer (including localhost), serving a 403 instead of the image.
        // Omitting the Referer header sidesteps that.
        referrerPolicy="no-referrer"
        className={cn(
          sizeClass,
          "shrink-0 rounded-full object-cover",
          className,
        )}
      />
    );
  }

  const initial = ((name?.trim()[0] ?? email[0]) ?? "?").toUpperCase();

  return (
    <div
      className={cn(
        sizeClass,
        "shrink-0 rounded-full bg-primary/10 font-medium text-primary",
        "flex items-center justify-center",
        className,
      )}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
