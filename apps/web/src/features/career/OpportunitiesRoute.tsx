import { useSearchParams } from "react-router-dom";
import { EMPTY_FILTERS, OpportunitiesPage } from "./OpportunitiesPage";

// ?source=demo (from the "Explore demo listings" actions) opens demo mode; anything else is live.
export function OpportunitiesRoute() {
  const [params] = useSearchParams();
  const source = params.get("source") === "demo" ? "demo" : "live";
  return <OpportunitiesPage key={source} initial={{ ...EMPTY_FILTERS, source }} />;
}
