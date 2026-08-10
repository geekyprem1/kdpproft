import { redirect } from "next/navigation";

// Dedicated nav entry → unified Create wizard with the type preselected.
export default function Page() {
  redirect("/dashboard/create?type=word-search");
}
