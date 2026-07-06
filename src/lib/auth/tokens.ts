import bcrypt from "bcryptjs"
import { createHash, randomBytes } from "crypto"

export type { AccessTokenPayload } from "./jwt"
export { signAccessToken, verifyAccessToken } from "./jwt"

const REFRESH_TOKEN_DAYS = 30

export const hashPassword = async (password: string) => bcrypt.hash(password, 12)

export const verifyPassword = async (password: string, hash: string) =>
  bcrypt.compare(password, hash)

export const hashRefreshToken = (token: string) =>
  createHash("sha256").update(token).digest("hex")

export const generateRefreshToken = () => randomBytes(48).toString("base64url")

export const getRefreshTokenExpiry = () => {
  const date = new Date()
  date.setDate(date.getDate() + REFRESH_TOKEN_DAYS)
  return date
}
