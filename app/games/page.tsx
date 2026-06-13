import { Suspense } from "react";
import BrowseGamesClient from "./BrowseGamesClient";

export default function BrowseGamesPage() {
  return (
    <Suspense fallback={null}>
      <BrowseGamesClient />
    </Suspense>
  );
}
