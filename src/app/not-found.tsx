import Link from "next/link";
import { Mark } from "@/components/site/Mark";

export default function NotFound() {
  return (
    <main className="shell flex min-h-[60vh] flex-col items-start justify-center gap-5 py-20">
      <Mark size={56} />
      <h1 className="headline">
        <span className="fade">Nothing runs</span> at this address.
      </h1>
      <p className="lead max-w-lg">The link may be mistyped, or the page has moved.</p>
      <div className="flex gap-3">
        <Link href="/" className="btn btn-ink">
          Home
        </Link>
        <Link href="/app" className="btn btn-ghost">
          Workspace
        </Link>
      </div>
    </main>
  );
}
