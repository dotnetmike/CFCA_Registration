export const splitSqlStatements = (sql: string): string[] => {
  const statements: string[] = []
  let current = ""
  let inDollarQuote = false
  let dollarTag = ""

  const lines = sql.split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    if (!inDollarQuote && trimmed.startsWith("--")) continue

    if (!inDollarQuote) {
      const match = line.match(/\$([a-zA-Z_]*)\$/)
      if (match) {
        inDollarQuote = true
        dollarTag = match[0]
      }
    } else if (line.includes(dollarTag)) {
      inDollarQuote = false
      dollarTag = ""
    }

    current += line + "\n"

    if (!inDollarQuote && line.trim().endsWith(";")) {
      const stmt = current.trim()
      if (stmt.length > 0) statements.push(stmt)
      current = ""
    }
  }

  const remaining = current.trim()
  if (remaining.length > 0) statements.push(remaining)
  return statements
}
