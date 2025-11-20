import {describe, expect, it} from '@jest/globals'

import {convertAmount, hasCurrencyError} from './util'

describe('hasCurrencyError', () => {
  describe('has no error', () => {
    it('when value is empty string', () => {
      expect(hasCurrencyError('')).toEqual(false)
    })
    it('when value is integer string', () => {
      expect(hasCurrencyError('123')).toEqual(false)
    })
    it('when value is number string with two decimal places', () => {
      expect(hasCurrencyError('123.45')).toEqual(false)
    })
    it('when value is number string with three decimal places', () => {
      expect(hasCurrencyError('123.456')).toEqual(false)
    })
  })
  describe('has error', () => {
    it('when value contains letters', () => {
      expect(hasCurrencyError('123.456a')).toEqual(true)
    })
  })
})

describe('convertAmount', () => {
  describe('decimal currencies', () => {
    it('converts integer to cents', () => {
      expect(convertAmount('123', 'USD')).toEqual(12300)
    })
    it('converts decimal to cents', () => {
      expect(convertAmount('123.45', 'USD')).toEqual(12345)
    })
    it('rounds up decimals to cents', () => {
      expect(convertAmount('123.45678', 'USD')).toEqual(12346)
    })
    it('rounds down decimals to cents', () => {
      expect(convertAmount('123.452', 'USD')).toEqual(12345)
    })
    it('accepts numbers at the start of strings', () => {
      expect(convertAmount('1a2b3c', 'USD')).toEqual(100)
    })
  })

  describe('zero-decimal currencies', () => {
    it('converts integer as-is for JPY', () => {
      expect(convertAmount('1000', 'JPY')).toEqual(1000)
    })
    it('rounds decimals for JPY', () => {
      expect(convertAmount('1000.67', 'JPY')).toEqual(1001)
    })
    it('converts integer as-is for HUF', () => {
      expect(convertAmount('500', 'HUF')).toEqual(500)
    })
    it('rounds decimals for HUF', () => {
      expect(convertAmount('500.3', 'HUF')).toEqual(500)
    })
  })

  describe('returns NaN', () => {
    it('when passed empty string', () => {
      expect(convertAmount('', 'USD')).toBeNaN()
    })
    it('for strings that start with letters', () => {
      expect(convertAmount('a1b2c3', 'USD')).toBeNaN()
    })
  })
})
