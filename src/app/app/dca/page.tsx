import { Suspense } from "react";
import { DcaDesk } from "@/components/app/DcaDesk";

export default function DcaPage() {
  return (
    <Suspense>
      <DcaDesk />
    </Suspense>
  );
}
