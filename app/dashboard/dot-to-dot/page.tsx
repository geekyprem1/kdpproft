import { redirect } from "next/navigation";

export default function Page() {
  redirect("/dashboard/create?type=dot_to_dot");
}
