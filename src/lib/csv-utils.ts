const DEFAULT_DELIMITER = ','

const needsQuoting = (value: string) => /[",\r\n]/.test(value)

const toStringValue = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value.toString()
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

export const serializeCsv = (
  rows: Array<Array<unknown>>,
  options: { delimiter?: string; includeBom?: boolean } = {}
): string => {
  const delimiter = options.delimiter ?? DEFAULT_DELIMITER
  const includeBom = options.includeBom ?? true

  const encodedRows = rows.map(row => {
    return row
      .map(cell => {
        const raw = toStringValue(cell)
        if (raw.length === 0) return ''
        if (!needsQuoting(raw)) return raw
        return `"${raw.replace(/"/g, '""')}"`
      })
      .join(delimiter)
  })

  const csv = encodedRows.join('\r\n')
  return includeBom ? `\uFEFF${csv}` : csv
}

export const parseCsv = (
  text: string,
  options: { delimiter?: string; skipEmptyRows?: boolean } = {}
): string[][] => {
  const delimiter = options.delimiter ?? DEFAULT_DELIMITER
  const skipEmptyRows = options.skipEmptyRows ?? true

  const rows: string[][] = []
  let currentRow: string[] = []
  let currentValue = ''
  let inQuotes = false
  const input = text.replace(/^\uFEFF/, '')

  const pushValue = () => {
    currentRow.push(currentValue)
    currentValue = ''
  }

  const pushRow = () => {
    if (skipEmptyRows) {
      const isEmpty = currentRow.every(cell => cell.trim() === '')
      if (!isEmpty) {
        rows.push(currentRow)
      }
    } else {
      rows.push(currentRow)
    }
    currentRow = []
  }

  for (let i = 0; i <= input.length; i++) {
    const char = input[i]

    if (inQuotes) {
      if (char === '"') {
        const nextChar = input[i + 1]
        if (nextChar === '"') {
          currentValue += '"'
          i++
        } else {
          inQuotes = false
        }
      } else if (char === undefined) {
        // Unterminated quotes – treat as end of value
        inQuotes = false
      } else {
        currentValue += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === delimiter) {
      pushValue()
      continue
    }

    if (char === '\r') {
      pushValue()
      if (input[i + 1] === '\n') {
        i++
      }
      pushRow()
      continue
    }

    if (char === '\n') {
      pushValue()
      pushRow()
      continue
    }

    if (char === undefined) {
      pushValue()
      pushRow()
      continue
    }

    currentValue += char
  }

  if (!skipEmptyRows && currentRow.length > 0) {
    rows.push(currentRow)
  }

  return rows
}

export const parseCsvToObjects = (
  text: string,
  options: { delimiter?: string; headerCase?: 'original' | 'lower' } = {}
): Array<Record<string, string>> => {
  const rows = parseCsv(text, { delimiter: options.delimiter })
  if (rows.length === 0) return []

  const headers = rows[0].map(header => {
    if (options.headerCase === 'lower') return header.trim().toLowerCase()
    return header.trim()
  })

  const dataRows = rows.slice(1)

  return dataRows.map(row => {
    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      record[header] = row[index]?.trim() ?? ''
    })
    return record
  })
}
