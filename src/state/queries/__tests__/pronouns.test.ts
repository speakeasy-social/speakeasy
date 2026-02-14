import {describe, expect, it} from '@jest/globals'

import {
  formatPronounSetsForEditing,
  getNativePronouns,
  getProfilePronouns,
  parsePronounsInput,
  PRONOUNS_MAX_GRAPHEMES,
} from '../pronouns'

describe('parsePronounsInput', () => {
  it('returns empty array for empty string', () => {
    expect(parsePronounsInput('')).toEqual([])
  })

  it('returns empty array for whitespace-only string', () => {
    expect(parsePronounsInput('   ')).toEqual([])
  })

  it('parses single pronoun set with slash', () => {
    expect(parsePronounsInput('she/her')).toEqual([{forms: ['she', 'her']}])
  })

  it('parses multiple pronoun sets separated by comma', () => {
    expect(parsePronounsInput('she/her, they/them')).toEqual([
      {forms: ['she', 'her']},
      {forms: ['they', 'them']},
    ])
  })

  it('parses multiple pronoun sets separated by semicolon', () => {
    expect(parsePronounsInput('she/her; they/them')).toEqual([
      {forms: ['she', 'her']},
      {forms: ['they', 'them']},
    ])
  })

  it('treats freeform text without slashes as single entry', () => {
    expect(parsePronounsInput('any pronouns')).toEqual([
      {forms: ['any pronouns']},
    ])
  })

  it('treats single word as freeform entry', () => {
    expect(parsePronounsInput('any')).toEqual([{forms: ['any']}])
  })

  it('handles three-form pronoun set', () => {
    expect(parsePronounsInput('he/him/his')).toEqual([
      {forms: ['he', 'him', 'his']},
    ])
  })

  it('handles three pronoun sets', () => {
    expect(parsePronounsInput('she/her, they/them, he/him')).toEqual([
      {forms: ['she', 'her']},
      {forms: ['they', 'them']},
      {forms: ['he', 'him']},
    ])
  })

  it('trims leading/trailing whitespace', () => {
    expect(parsePronounsInput('  she/her  ')).toEqual([{forms: ['she', 'her']}])
  })

  it('treats "she/her any" as single set with three forms', () => {
    // When only the first part has `/`, the entire input is one set.
    // This means "she/her any" → 1 set written to native field only,
    // not the atproto record (which requires sets.length >= 2).
    expect(parsePronounsInput('she/her any')).toEqual([
      {forms: ['she', 'her', 'any']},
    ])
  })
})

describe('getNativePronouns', () => {
  it('returns empty string for empty array', () => {
    expect(getNativePronouns([])).toBe('')
  })

  it('returns first set joined with slash', () => {
    expect(getNativePronouns([{forms: ['she', 'her']}])).toBe('she/her')
  })

  it('returns only first set when multiple exist', () => {
    expect(
      getNativePronouns([{forms: ['she', 'her']}, {forms: ['they', 'them']}]),
    ).toBe('she/her')
  })

  it('returns freeform text as-is', () => {
    expect(getNativePronouns([{forms: ['any pronouns']}])).toBe('any pronouns')
  })
})

describe('getProfilePronouns', () => {
  it('returns undefined for undefined profile', () => {
    expect(getProfilePronouns(undefined)).toBeUndefined()
  })

  it('returns undefined when profile has no pronouns field', () => {
    const profile = {did: 'did:plc:test', handle: 'test.bsky.social'} as any
    expect(getProfilePronouns(profile)).toBeUndefined()
  })

  it('returns pronouns string when present', () => {
    const profile = {
      did: 'did:plc:test',
      handle: 'test.bsky.social',
      pronouns: 'she/her',
    } as any
    expect(getProfilePronouns(profile)).toBe('she/her')
  })

  it('returns undefined for empty string pronouns', () => {
    const profile = {
      did: 'did:plc:test',
      handle: 'test.bsky.social',
      pronouns: '',
    } as any
    expect(getProfilePronouns(profile)).toBeUndefined()
  })
})

describe('PRONOUNS_MAX_GRAPHEMES', () => {
  it('is 20', () => {
    expect(PRONOUNS_MAX_GRAPHEMES).toBe(20)
  })
})

describe('formatPronounSetsForEditing', () => {
  it('formats single set', () => {
    expect(formatPronounSetsForEditing({sets: [{forms: ['she', 'her']}]})).toBe(
      'she/her',
    )
  })

  it('formats multiple sets with comma separator', () => {
    expect(
      formatPronounSetsForEditing({
        sets: [{forms: ['she', 'her']}, {forms: ['they', 'them']}],
      }),
    ).toBe('she/her, they/them')
  })

  it('formats freeform entry', () => {
    expect(
      formatPronounSetsForEditing({sets: [{forms: ['any pronouns']}]}),
    ).toBe('any pronouns')
  })
})
