export const getGooglePlacesApiKey = (): string | undefined =>
  process.env.GOOGLE_PLACES_API_KEY ??
  process.env.GOOGLE_MAPS_API_KEY ??
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
