import { ADULT_MIN_AGE, CHILD_MIN_AGE, YOUTH_MIN_AGE } from "@/lib/pricing/calculate"

export type PeopleCount = {
  registrants: number
  spouses: number
  /** Additional attendees aged 18+. */
  additionalAdults: number
  /** Additional attendees under 18 (= teens + children + infants). */
  kids: number
  /** Additional attendees aged 12–17. */
  teens: number
  /** Additional attendees aged 2–11. */
  children: number
  /** Additional attendees aged 0–1. */
  infants: number
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
  teens: 0,
  children: 0,
  infants: 0,
  people: 0,
})

export const countRegistrationPeople = (registration: RegistrationWithAttendees): PeopleCount => {
  const attendees = registration.registration_attendees ?? []
  const ages = attendees.map((a) => Number(a.age ?? 0))
  const additionalAdults = ages.filter((age) => age >= ADULT_MIN_AGE).length
  const teens = ages.filter((age) => age >= YOUTH_MIN_AGE && age < ADULT_MIN_AGE).length
  const children = ages.filter((age) => age >= CHILD_MIN_AGE && age < YOUTH_MIN_AGE).length
  const kids = attendees.length - additionalAdults
  const spouses = registration.spouse_attending ? 1 : 0
  return {
    registrants: 1,
    spouses,
    additionalAdults,
    kids,
    teens,
    children,
    infants: kids - teens - children,
    people: 1 + spouses + attendees.length,
  }
}

export const addPeopleCounts = (target: PeopleCount, add: PeopleCount) => {
  target.registrants += add.registrants
  target.spouses += add.spouses
  target.additionalAdults += add.additionalAdults
  target.kids += add.kids
  target.teens += add.teens
  target.children += add.children
  target.infants += add.infants
  target.people += add.people
}
