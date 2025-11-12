import * as tokens from '#/alf/tokens'

/**
 * Converts a gradient token to a CSS linear-gradient string
 * @param gradient - The gradient token to convert
 * @param angle - The angle of the gradient in degrees (default: 135)
 * @returns A CSS linear-gradient string
 */
export function gradientTokenToCss(
  gradient:
    | typeof tokens.gradients.primary
    | typeof tokens.gradients.sky
    | typeof tokens.gradients.midnight
    | typeof tokens.gradients.sunrise
    | typeof tokens.gradients.sunset
    | typeof tokens.gradients.bonfire
    | typeof tokens.gradients.summer
    | typeof tokens.gradients.nordic,
  angle = 135,
): string {
  const stops = gradient.values
    .map(stop => `${stop[1]} ${stop[0] * 100}%`)
    .join(', ')
  return `linear-gradient(${angle}deg, ${stops})`
}
