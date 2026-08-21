import type { TransportOption } from "@/lib/registrations/transport"
import { Alert } from "@/components/ui/alert"
import { CFCA_AIRPORT_PICKUP_EXCEPTION_POSITIONS } from "@/lib/registrations/schema"

type TransportScheduleAlertProps = {
  transportOption: TransportOption
  cfcaPosition?: string | null
}

export const TransportScheduleAlert = ({ transportOption, cfcaPosition }: TransportScheduleAlertProps) => {
  const isPickupException = CFCA_AIRPORT_PICKUP_EXCEPTION_POSITIONS.includes(
    (cfcaPosition ?? "") as (typeof CFCA_AIRPORT_PICKUP_EXCEPTION_POSITIONS)[number]
  )

  if (transportOption === "pickup") {
    return (
      <Alert variant="info">
        {isPickupException ? (
          <>
            <strong>Pick-up</strong> at Tullamarine is available from{" "}
            <strong>Thursday, 8 April 2027, 5am–10pm</strong>. Pick-up from other airports (e.g.
            Avalon) may not be available.
          </>
        ) : (
          <>
            <strong>Pick-up</strong> at Tullamarine is available only on{" "}
            <strong>Friday, 9 April 2027, 5am–10pm</strong>. Pick-up from other airports (e.g. Avalon)
            may not be available.
          </>
        )}
      </Alert>
    )
  }

  if (transportOption === "dropoff") {
    return (
      <Alert variant="info">
        <strong>Drop-off</strong> at Tullamarine is available only on{" "}
        <strong>Sunday, 11 April 2027, 5am–10pm</strong>. Drop-off from other airports (e.g. Avalon)
        may not be available.
      </Alert>
    )
  }

  if (transportOption === "pickup_dropoff") {
    return (
      <Alert variant="info">
        {isPickupException ? (
          <>
            <strong>Pick-up and drop-off</strong> at Tullamarine: <strong>pick-up from Thursday, 8
            April 2027, 5am–10pm</strong> and <strong>drop-off Sunday, 11 April 2027,
            5am–10pm</strong>. Transport from other airports (e.g. Avalon) may not be available.
          </>
        ) : (
          <>
            <strong>Pick-up and drop-off</strong> at Tullamarine: <strong>pick-up Friday, 9 April 2027,
            5am–10pm</strong> and <strong>drop-off Sunday, 11 April 2027, 5am–10pm</strong>. Transport
            from other airports (e.g. Avalon) may not be available.
          </>
        )}
      </Alert>
    )
  }

  return null
}
