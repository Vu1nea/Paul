describe('secrets encryption', () => {
  beforeAll(() => {
    process.env.PAUL_SECRET_KEY = 'test_key_exactly_32_characters!!'
  })

  it('encrypt and decrypt round-trips correctly', () => {
    // Re-require after env var is set
    jest.resetModules()
    const { encryptValue, decryptValue } = require('../secrets')
    const original = 'my-api-key-value'
    const encrypted = encryptValue(original)
    expect(encrypted).not.toBe(original)
    expect(encrypted).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/)
    expect(decryptValue(encrypted)).toBe(original)
  })

  it('produces different ciphertext each time (random IV)', () => {
    jest.resetModules()
    const { encryptValue } = require('../secrets')
    const a = encryptValue('same value')
    const b = encryptValue('same value')
    expect(a).not.toBe(b)
  })
})
