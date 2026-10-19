import { afterEach, describe, expect, it, vi } from "vitest"
import { getNotifyPort, noopNotifyPort, setNotifyPort } from "../port"

afterEach(() => {
  setNotifyPort()
  vi.restoreAllMocks()
})

describe("NotifyPort", () => {
  it("defaults to a no-op that logs ids only, never personal data", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})

    await getNotifyPort().notify({ type: "NEW_LEAD", leadId: "l1", contactId: "c1", conversationId: "conv1" })

    expect(getNotifyPort()).toBe(noopNotifyPort)
    expect(info).toHaveBeenCalledWith("[notify] NEW_LEAD lead=l1 (no-op port)")
  })

  it("lets a real implementation replace the default and restores it with no argument", async () => {
    const notify = vi.fn(async () => {})
    setNotifyPort({ notify })

    await getNotifyPort().notify({ type: "NEW_ACTIVITY_ON_ESCALATED", conversationId: "conv1" })
    expect(notify).toHaveBeenCalledTimes(1)

    setNotifyPort()
    expect(getNotifyPort()).toBe(noopNotifyPort)
  })
})
