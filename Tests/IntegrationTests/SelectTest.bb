Function TestSelect()
    Local results = 0
    
    ; Test multiple values
    Local x = 2
    Select x
        Case 1, 2, 3
            Print "Multi-value match: OK"
            results = results + 1
        Default
            Print "Multi-value match: FAIL"
    End Select
    
    ; Test range
    Local y = 15
    Select y
        Case 10 To 20
            Print "Range match: OK"
            results = results + 1
        Default
            Print "Range match: FAIL"
    End Select
    
    ; Test mixed
    Local z = 5
    Select z
        Case 1, 5, 10 To 20
             Print "Mixed match: OK"
             results = results + 1
        Default
             Print "Mixed match: FAIL"
    End Select

    ; Test no match
    Local w = 100
    Select w
        Case 1, 2
            Print "No match: FAIL 1"
        Case 10 To 20
            Print "No match: FAIL 2"
        Default
            Print "No match: OK"
            results = results + 1
    End Select

    If results = 4 Then
        Print "All Select tests passed"
    Else
        Print "Some Select tests failed"
    EndIf
End Function

TestSelect()
