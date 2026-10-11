import { customAlphabet } from 'nanoid'

const nano = customAlphabet('0123456789abcdefghijkmnpqrstuvwxyz', 8)

export const uid = (prefix: string) => `${prefix}_${nano()}`
