import { Suspense } from "react";

import { LibraryScreen } from "@/components/woi/library-screen";

export default function LibraryPage() {
  return (
    <Suspense fallback={null}>
      <LibraryScreen />
    </Suspense>
  );
}
