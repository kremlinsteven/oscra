import { canonical, recordMessage, sha256Hex, type Action, type Board } from "@/lib/records-shared";

/* Browser side of the wallet-signed records: read the board, sign one record and post it. */

export async function fetchBoard(wallet: string | null): Promise<Board> {
  const res = await fetch(`/api/records${wallet ? `?wallet=${wallet}` : ""}`, { cache: "no-store" });
  if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `Records ${res.status}`);
  return (await res.json()) as Board;
}

export async function signRecord(wallet: string, signMessage: (m: string) => Promise<string>, action: Action, payload: unknown): Promise<string> {
  const n = await fetch(`/api/nonce?wallet=${wallet}`, { cache: "no-store" });
  const nb = (await n.json().catch(() => null)) as { nonce?: string; issuedAt?: string; error?: string } | null;
  if (!n.ok || !nb?.nonce || !nb.issuedAt) throw new Error(nb?.error ?? "Could not start the signature.");
  const message = recordMessage({ wallet, action, payloadHash: await sha256Hex(canonical(payload)), nonce: nb.nonce, issuedAt: nb.issuedAt });
  const signature = await signMessage(message);
  const res = await fetch("/api/records", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet, action, payload, nonce: nb.nonce, issuedAt: nb.issuedAt, signature }) });
  const body = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
  if (!res.ok) throw new Error(body?.error ?? `Records ${res.status}`);
  return body?.message ?? "Saved.";
}
