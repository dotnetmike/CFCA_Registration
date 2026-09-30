import { redirect } from "next/navigation"

/** Preview V2 pay-step flow without flipping Dashboard Settings. */
const RegisterV2PreviewPage = () => {
  redirect("/?workflow=v2")
}

export default RegisterV2PreviewPage
