import { Suspense } from "react";
import { FileBrowser } from "@/components/file-manager/file-browser";

export default function Home() {
  return (
    <Suspense>
      <FileBrowser />
    </Suspense>
  );
}
