// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({ value: false }))
const writeFile = vi.hoisted(() => vi.fn())
const share = vi.hoisted(() => vi.fn())

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native.value },
}))
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile },
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
}))
vi.mock('@capacitor/share', () => ({ Share: { share } }))

import { saveTextFile } from './saveFile'

beforeEach(() => {
  native.value = false
  writeFile.mockReset()
  share.mockReset()
})

describe('saveTextFile', () => {
  it('downloads through the browser on the web', async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:bloom')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await saveTextFile('bloom.json', 'application/json', '{"ok":true}')

    expect(createObjectURL).toHaveBeenCalledOnce()
    const blob = createObjectURL.mock.calls[0][0]
    expect(blob.type).toBe('application/json')
    expect(click).toHaveBeenCalledOnce()
    click.mockRestore()
  })

  it('writes to the cache and opens the share sheet on Android', async () => {
    native.value = true
    writeFile.mockResolvedValue({ uri: 'file:///cache/bloom.json' })
    share.mockResolvedValue(undefined)

    await saveTextFile('bloom.json', 'application/json', '{"ok":true}')

    expect(writeFile).toHaveBeenCalledWith({
      path: 'bloom.json',
      data: '{"ok":true}',
      directory: 'CACHE',
      encoding: 'utf8',
      recursive: true,
    })
    expect(share).toHaveBeenCalledWith({
      title: 'bloom.json',
      url: 'file:///cache/bloom.json',
      dialogTitle: 'Save Bloom data',
    })
  })

  it('treats a dismissed share sheet as a normal choice', async () => {
    native.value = true
    writeFile.mockResolvedValue({ uri: 'file:///cache/bloom.json' })
    share.mockRejectedValue(new Error('Share canceled'))

    await expect(saveTextFile('bloom.json', 'application/json', '{}')).resolves.toBeUndefined()
  })

  it('lets a real share failure surface so the caller can show an error', async () => {
    native.value = true
    writeFile.mockResolvedValue({ uri: 'file:///cache/bloom.json' })
    share.mockRejectedValue(new Error('No activity found'))

    await expect(saveTextFile('bloom.json', 'application/json', '{}')).rejects.toThrow(
      'No activity found',
    )
  })
})
