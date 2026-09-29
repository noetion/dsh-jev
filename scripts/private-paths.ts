// Match private home paths, not public names such as GitHub owners or attribution.
export function hasPrivateHostPath(text: string): boolean {
  return /(?<!\w)(?:[a-z]:[\\/]+Users[\\/]+|\/(?:Users|home)\/)[^\s\\/"']+/i.test(text)
}
