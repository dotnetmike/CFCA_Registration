import { test } from "node:test"
import assert from "node:assert/strict"
import { safeRedirectPath } from "./paths"

test("safeRedirectPath keeps same-site paths with their query string", () => {
  assert.equal(
    safeRedirectPath("/my-registration?payment=success&session_id=cs_live_abc"),
    "/my-registration?payment=success&session_id=cs_live_abc"
  )
  assert.equal(safeRedirectPath("/dashboard/reports"), "/dashboard/reports")
})

test("safeRedirectPath falls back for missing or off-site targets", () => {
  assert.equal(safeRedirectPath(null), "/my-registration")
  assert.equal(safeRedirectPath(""), "/my-registration")
  assert.equal(safeRedirectPath("https://evil.example"), "/my-registration")
  assert.equal(safeRedirectPath("//evil.example/path"), "/my-registration")
  assert.equal(safeRedirectPath("/\\evil.example"), "/my-registration")
  assert.equal(safeRedirectPath("javascript:alert(1)", "/"), "/")
})
