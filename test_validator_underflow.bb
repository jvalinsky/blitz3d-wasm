; Test for Issue #2: Stack Validator should not emit drops on underflow
; This should NOT cause spurious drop instructions to be emitted

Function VoidFunction()
    ; Function with no return value
End Function

Function Main()
    Local x% = 1

    ; This should not trigger any drops
    VoidFunction()

    ; Simple loop that shouldn't cause validator errors
    For i = 1 To 10
        x = x + 1
    Next
End Function
