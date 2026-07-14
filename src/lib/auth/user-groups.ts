export const USER_GROUP_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "registration_manager", label: "Registration Manager" },
  { value: "accommodation_manager", label: "Accommodation Manager" },
  { value: "participant", label: "Participant" },
] as const

export type UserGroupName = (typeof USER_GROUP_OPTIONS)[number]["value"]

export const USER_GROUP_NAMES: UserGroupName[] = USER_GROUP_OPTIONS.map((g) => g.value)

export const isUserGroupName = (value: string): value is UserGroupName =>
  (USER_GROUP_NAMES as string[]).includes(value)

export const formatUserGroupLabel = (name: string) =>
  USER_GROUP_OPTIONS.find((g) => g.value === name)?.label ?? name
