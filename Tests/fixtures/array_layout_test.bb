; Test array access with 1D and 2D arrays
Dim myArray%(10)
Dim myFloatArray#(5)
Dim myGrid%(3, 3)

; Test 1D integer array write and read
myArray(0) = 100
myArray(5) = 200
myArray(10) = 300

Print "Array[0]: " + Str(myArray(0))
Print "Array[5]: " + Str(myArray(5))  
Print "Array[10]: " + Str(myArray(10))

; Test 1D float array
myFloatArray(0) = 1.5
myFloatArray(3) = 3.14
Print "FloatArray[0]: " + Str(myFloatArray(0))
Print "FloatArray[3]: " + Str(myFloatArray(3))

; Test 2D array
For i = 0 To 3
    For j = 0 To 3
        myGrid(i, j) = i * 10 + j
    Next
Next

Print "Grid[0,0]: " + Str(myGrid(0, 0))
Print "Grid[1,2]: " + Str(myGrid(1, 2))
Print "Grid[3,3]: " + Str(myGrid(3, 3))
