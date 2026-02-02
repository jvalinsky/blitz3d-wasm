; Comment handling + whitespace + paren args
; Should compile and run deterministically.

Local x%, y%
x = 2
y = 3

; Parenthesized args mixed spacing (should parse correctly)
Print "sum=" + (x + y)
Print "sum2=" + (x+y)
