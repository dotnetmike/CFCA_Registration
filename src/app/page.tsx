import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"

const HomePage = () => (
  <div className="space-y-8">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-gray-900">CFCA Conference Registration</h1>
      <p className="mt-2 text-lg text-gray-600">
        Register for the conference, arrange transport and accommodation, and manage your payment.
      </p>
    </div>

    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Registration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Complete your conference registration form with personal details, attendees, and payment information.
          </p>
          <Link href="/register">
            <Button aria-label="Start registration">Register Now</Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            View bank transfer details and use your registration number as the payment reference.
          </p>
          <Link href="/payment">
            <Button variant="outline" aria-label="View payment information">Payment Info</Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transport &amp; Accommodation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="info">
            Pick-up and drop-off at Tullamarine (Melbourne Airport) available Fri 5am–10pm to Sun 5am–10pm.
            We may not be able to organise pick-up from other airports such as Avalon.
          </Alert>
          <Link href="/register">
            <Button variant="outline" aria-label="Manage transport and accommodation">Manage Details</Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registration / Helpdesk</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            For assistance with registration, transport, or accommodation, please contact the registration team.
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
)

export default HomePage
