import type { TransportOption } from "@/lib/registrations/transport"
import { Alert } from "@/components/ui/alert"

type TransportScheduleAlertProps = {
  transportOption: TransportOption
  elderAssemblyAttending?: boolean
}

export const TransportScheduleAlert = ({
  transportOption,
  elderAssemblyAttending = false,
}: TransportScheduleAlertProps) => {
  const pickupStartText = elderAssemblyAttending
    ? "Thursday, 8 April 2027"
    : "Friday, 9 April 2027"

  if (transportOption === "pickup") {
    return (
      <Alert variant="info">
        <strong>Pick-up</strong> at Tullamarine is available from{" "}
        <strong>{pickupStartText}, 7am–10pm</strong>. Pick-up from other airports (e.g.
        Avalon) may not be available.
      </Alert>
    )
  }

  if (transportOption === "dropoff") {
    return (
      <Alert variant="info">
        <strong>Drop-off</strong> at Tullamarine is available only on{" "}
        <strong>Sunday, 11 April 2027, 7am–10pm</strong>. Drop-off from other airports (e.g. Avalon)
        may not be available.
      </Alert>
    )
  }

  if (transportOption === "pickup_dropoff") {
    return (
      <Alert variant="info">
        <strong>Pick-up and drop-off</strong> at Tullamarine: <strong>pick-up from {pickupStartText}, 7am–10pm</strong> and <strong>drop-off Sunday, 11 April 2027, 7am–10pm</strong>. Transport from other airports (e.g. Avalon) may not be available.
      </Alert>
    )
  }

  return null
}
