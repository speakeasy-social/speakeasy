export const hasCurrencyError = (value: string): boolean => {
  const num = Number(value)
  return value === '' ? false : isNaN(num) || num <= 0
}

export const convertAmount = (value: string): number => {
  const rounded = Number.parseFloat(value).toFixed(2)
  return Number(rounded) * 100
}
