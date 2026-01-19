; Simple Hello World test
; Tests basic integer and float operations

Local x% = 10
Local y% = 20
Local sum% = x + y

Local a# = 1.5
Local b# = 2.5
Local fsum# = a + b

; Test control flow
If sum > 25 Then
    x = 100
Else
    x = 50
EndIf

; Test while loop
While x > 0
    x = x - 10
Wend

; Test for loop
For i = 1 To 5
    y = y + i
Next

; Test function call
Print(sum)

; Define a simple function
Function AddNumbers(a%, b%)
    Return a + b
End Function

Function MultiplyFloats#(a#, b#)
    Return a * b
End Function
