import { redirect } from "next/navigation";

// Cover Studio has been unified onto the V2 engine. This route now forwards to
// it so old links and bookmarks keep working.
export default function CoverPage() {
  redirect("/dashboard/cover-v2");
}
