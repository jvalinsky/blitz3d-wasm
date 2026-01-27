; Test for Issue #3A: Function arguments should be type-converted
; This tests that float arguments are converted to int when needed

Function DrawImage(img%, x%, y%)
    ; Stub function - just print debug info would go here
End Function

Function TestIntParams(a%, b%, c%)
    ; Another test function
End Function

Function Main()
    ; Test 1: Pass floats where ints are expected
    Local x# = 1.5
    Local y# = 2.5
    DrawImage(0, x, y)  ; Should convert x# and y# from f32 to i32

    ; Test 2: Pass mixed types
    Local a# = 3.14
    Local b% = 5
    TestIntParams(a, b, 10)  ; Should convert a# to i32

    ; Test 3: Ensure float-to-float doesn't break
    Local z# = 4.0
    Local w# = z# + 1.0  ; Should stay f32
End Function
