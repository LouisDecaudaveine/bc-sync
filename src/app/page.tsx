import { redirect } from "next/navigation";
import { hasCredentials } from "@/lib/credentials";

export default function Home() {
  redirect(hasCredentials() ? "/releases" : "/setup");
}
