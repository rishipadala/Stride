import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Landing from "@/components/Landing";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/today");
  return <Landing />;
}
