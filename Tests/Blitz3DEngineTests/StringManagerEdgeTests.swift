import Testing

@testable import Blitz3DEngine

@Test @MainActor func freeStringRemovesEntryAndLenBecomesZero() {
    let id = StringManager.shared.storeString("hello")
    #expect(StringManager.shared.getString(id) == "hello")
    #expect(Len(id) == 5)

    FreeString(id)
    #expect(StringManager.shared.getString(id) == nil)
    #expect(Len(id) == 0)
}

@Test @MainActor func midStartZeroBehavesLikeStartOne() {
    let id = StringManager.shared.storeString("abcd")
    let r = Mid(id, 0, 2) // start is 1-indexed; 0 clamps to 0-based startIndex=0
    #expect(StringManager.shared.getString(r) == "ab")
}

@Test @MainActor func instrStartBeyondEndReturnsZero() {
    let hay = StringManager.shared.storeString("abc")
    let needle = StringManager.shared.storeString("a")
    #expect(Instr(hay, needle, 99) == 0)
}

@Test @MainActor func midNegativeLengthReturnsEmpty() {
    let id = StringManager.shared.storeString("abcd")
    let r = Mid(id, 2, -1)
    #expect(StringManager.shared.getString(r) == "")
}

@Test @MainActor func leftNegativeLengthReturnsEmpty() {
    let id = StringManager.shared.storeString("abcd")
    let r = Left(id, -5)
    #expect(StringManager.shared.getString(r) == "")
}

@Test @MainActor func stringRepeatNegativeCountReturnsEmpty() {
    let id = StringManager.shared.storeString("ab")
    let r = StringRepeat(id, -3)
    #expect(StringManager.shared.getString(r) == "")
}
