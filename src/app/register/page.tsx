import { redirect } from "next/navigation"

type RegisterPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const RegisterPage = async ({ searchParams }: RegisterPageProps) => {
  const params = (await searchParams) ?? {}
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value) query.set(key, value)
    else if (Array.isArray(value) && value[0]) query.set(key, value[0])
  }
  const qs = query.toString()
  redirect(qs ? `/?${qs}` : "/")
}

export default RegisterPage
