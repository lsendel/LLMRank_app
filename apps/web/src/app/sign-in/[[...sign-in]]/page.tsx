import { SignIn } from "@/components/auth/sign-in";

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white p-8 shadow-lg rounded-lg">
        <SignIn />
      </div>
    </div>
  );
}
