import LoginClient from "./LoginClient";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const nextParam = searchParams?.next;
  const next =
    typeof nextParam === "string"
      ? nextParam
      : Array.isArray(nextParam)
      ? nextParam[0]
      : null;

  return <LoginClient next={next} />;
}