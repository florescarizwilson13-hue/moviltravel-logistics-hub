import { DriverMobilePanel } from "@/components/driver/driver-mobile-panel";

export default async function DriverPage({
  searchParams
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  const { phone } = await searchParams;

  return <DriverMobilePanel initialPhone={phone ?? ""} />;
}
