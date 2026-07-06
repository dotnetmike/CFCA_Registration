import type { TransportOption } from "@/lib/registrations/transport"
import { Alert } from "@/components/ui/alert"

type TransportScheduleAlertProps = {
  transportOption: TransportOption
}

export const TransportScheduleAlert = ({ transportOption }: TransportScheduleAlertProps) => {
  if (transportOption === "pickup") {
    return (
      <Alert variant="info">
        <strong>Pick-up</strong> at Tullamarine is available{" "}
        <strong>Friday 5am–10pm</strong>. Pick-up from other airports (e.g. Avalon) may not be
        available.
      </Alert>
    )
  }

  if (transportOption === "dropoff") {
    return (
      <Alert variant="info">
        <strong>Drop-off</strong> at Tullamarine is available{" "}
        <strong>Sunday 5am–10pm</strong>. Drop-off from other airports (e.g. Avalon) may not be
        available.
      </Alert>
    )
  }

  if (transportOption === "pickup_dropoff") {
    return (
      <Alert variant="info">
        <strong>Pick-up and drop-off</strong> at Tullamarine:{" "}
        <strong>pick-up Friday 5am–10pm</strong> and{" "}
        <strong>drop-off Sunday 5am–10pm</strong>. Transport from other airports (e.g. Avalon) may
        not be available.
      </Alert>
    )
  }

  return null
}
