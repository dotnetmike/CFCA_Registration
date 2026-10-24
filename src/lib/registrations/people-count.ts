import { ADULT_MIN_AGE } from "@/lib/pricing/calculate"

export type PeopleCount = {
  registrants: number
  spouses: number
  /** Additional attendees aged 18+. */
  additionalAdults: number
  /** Additional attendees under 18. */
  kids: number
  /** Everyone attending: registrant + spouse + all additional attendees. */
  people: number
}

type RegistrationWithAttendees = {
  spouse_attending?: boolean | null
  registration_attendees?: { age?: number | string | null }[] | null
}

export const emptyPeopleCount = (): PeopleCount => ({
  registrants: 0,
  spouses: 0,
  additionalAdults: 0,
  kids: 0,
  people: 0,
})

export const countRegistrationPeople = (registration: RegistrationWithAttendees): PeopleCount => {
  const attendees = registration.registration_attendees ?? []
  const additionalAdults = attendees.filter((a) => Number(a.age ?? 0) >= ADULT_MIN_AGE).length
  const kids = attendees.length - additionalAdults
  const spouses = registration.spouse_attending ? 1 : 0
  return {
    registrants: 1,
    spouses,
    additionalAdults,
    kids,
    people: 1 + spouses + attendees.length,
  }
}

export const addPeopleCounts = (target: PeopleCount, add: PeopleCount) => {
  target.registrants += add.registrants
  target.spouses += add.spouses
  target.additionalAdults += add.additionalAdults
  target.kids += add.kids
  target.people += add.people
}
