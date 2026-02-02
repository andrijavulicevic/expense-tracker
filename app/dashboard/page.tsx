import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/app/components/LogoutButton";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Welcome, {session.user?.name}!</h1>
        <LogoutButton />
      </div>
      <p className="mt-4 text-gray-600">Email: {session.user?.email}</p>
    </div>
  );
}
