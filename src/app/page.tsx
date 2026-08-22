import RegistrationForm from "@/components/registrations/registration-form"
import { getRegistrationRuntimeSettings } from "@/lib/registration-settings"

export const dynamic = "force-dynamic"

const ClosedRegistrationPage = () => (
	<div className="cfca-page mx-auto max-w-3xl space-y-6">
		<div className="rounded-xl border border-[color:var(--line)] bg-surface p-6 shadow-sm">
			<p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
				Registration Update
			</p>
			<h1 className="mt-2 font-display text-3xl font-semibold text-ink">
				Registration is now closed
			</h1>
			<p className="mt-4 text-base text-ink-soft">
				Thank you for your interest in the conference. Registration has closed for now.
			</p>
			<p className="mt-3 text-base text-ink-soft">
				If you have any questions, please contact your respective Chapter Leader.
			</p>
		</div>
	</div>
)

const HomePage = async () => {
	const settings = await getRegistrationRuntimeSettings()

	if (!settings.registrationOpen) {
		return <ClosedRegistrationPage />
	}

	return <RegistrationForm pricingConfig={settings.pricing} />
}

export default HomePage
