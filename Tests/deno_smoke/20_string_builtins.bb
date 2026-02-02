Local s$
s = "  AbcDef  "

Print "len=" + Len(s)
Print "trim=[" + Trim$(s) + "]"
Print "upper=[" + Upper$(s) + "]"
Print "lower=[" + Lower$(s) + "]"
Print "left=[" + Left$(s, 3) + "]"
Print "right=[" + Right$(s, 3) + "]"
Print "mid=[" + Mid$(s, 3, 3) + "]"
Print "instr=" + Instr(s, "cD", 1)
Print "replace=[" + Replace$(s, "Abc", "XYZ") + "]"
Print "chr=" + Chr$(65)
Print "asc=" + Asc("A")
Print "string=" + String$("x", 3)
