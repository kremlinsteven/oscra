/** The OSCRA helmet (owner's 3D render, trimmed). A plain image: a multi-colour render cannot be a mask. */
export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return <img src="/brand/mark-160.webp" alt="" width={size} height={size} className={`shrink-0 object-contain ${className}`} style={{ width: size, height: size }} />;
}

/** Mark plus the name as text, for the header and footer. */
export function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Mark size={26} />
      <span className={`text-[17px] font-semibold tracking-[0.08em] ${dark ? "text-night-ink" : "text-ink"}`}>OSCRA</span>
    </span>
  );
}
