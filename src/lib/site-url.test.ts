import assert from "node:assert/strict"
import test from "node:test"
import { getRequestSiteUrl } from "./site-url"

const makeRequest = (headers: Record<string, string>) =>
  new Request("http://internal/", { headers })

test("uses x-forwarded-host and x-forwarded-proto when present", () => {
  const url = getRequestSiteUrl(
    makeRequest({
      host: "localhost:3000",
      "x-forwarded-host": "cfcanorth.online",
      "x-forwarded-proto": "https",
    })
  )
  assert.equal(url, "https://cfcanorth.online")
})

test("defaults localhost host to http", () => {
  assert.equal(
    getRequestSiteUrl(makeRequest({ host: "localhost:3000" })),
    "http://localhost:3000"
  )
})

test("defaults public host to https when proto is missing", () => {
  assert.equal(
    getRequestSiteUrl(makeRequest({ host: "cfcanorth.online" })),
    "https://cfcanorth.online"
  )
})

test("takes the first value from comma-separated forwarded headers", () => {
  const url = getRequestSiteUrl(
    makeRequest({
      "x-forwarded-host": "cfcanorth.online, other.example",
      "x-forwarded-proto": "https, http",
    })
  )
  assert.equal(url, "https://cfcanorth.online")
})
