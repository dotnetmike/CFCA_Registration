export type ParsedName = {
  given_name: string
  surname: string
}

export const parseFullName = (fullName: string): ParsedName => {
  const trimmed = fullName.trim()
  if (!trimmed) return { given_name: "", surname: "" }

  if (trimmed.includes(",")) {
    const [surnamePart, givenPart] = trimmed.split(",").map((p) => p.trim())
    return {
      surname: surnamePart ?? "",
      given_name: givenPart ?? "",
    }
  }

  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return { given_name: parts[0], surname: "" }
  }

  return {
    given_name: parts.slice(0, -1).join(" "),
    surname: parts[parts.length - 1],
  }
}
