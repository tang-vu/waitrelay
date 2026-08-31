import { EmbeddedFlightFrame } from "@/components/flight";

export default async function FlightPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return <div className="flight-document"><EmbeddedFlightFrame forceReducedMotion={query.reduced === "1"} forceRendererFailure={query.crash === "1"} /></div>;
}
