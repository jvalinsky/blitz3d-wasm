; Test for Issue #1: If/else branches should be balanced
; This tests that branches with different stack effects are balanced with drops

Function GetValue%()
    Return 42
End Function

Function GetFloat#()
    Return 3.14
End Function

Function Main()
    ; Case 1: Then branch returns value, else is empty (should add drop to then)
    If True Then GetValue()

    ; Case 2: Both branches return values (both should be dropped since it's a statement)
    If False Then GetValue() Else GetValue()

    ; Case 3: Nested with assignment (should NOT trigger drops - value is consumed)
    Local x% = 0
    If True Then x = GetValue()

    ; Case 4: Else branch returns value, then is empty (should add drop to else)
    If False Then
        x = 1
    Else
        GetValue()
    EndIf

    ; Case 5: Mixed types - both should be dropped
    If True Then GetValue() Else GetFloat()

    ; Case 6: Complex nested case
    If x = 1 Then
        If True Then GetValue()
    EndIf
End Function
