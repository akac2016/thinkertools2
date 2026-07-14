import { Suspense } from "react";

import { WoiNewGameScreen } from "@/components/woi/new-game-screen";

export default function WoiNewGamePage() {
  return (
    <Suspense fallback={null}>
      <WoiNewGameScreen />
    </Suspense>
  );
}
