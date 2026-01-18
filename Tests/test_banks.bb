
b = CreateBank(10)
PokeByte(b, 0, 123)
val = PeekByte(b, 0)
Print "Value: " + val
ResizeBank(b, 20)
Print "Size: " + BankSize(b)
FreeBank(b)
