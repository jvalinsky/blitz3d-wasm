//
//  MathExports.swift
//  Blitz3DEngine
//
//  WASM exports for Blitz3D Math functions
//

import Foundation

// MARK: - Trigonometric Functions

@_cdecl("Sin")
public func Sin(_ angle: Float) -> Float {
    return sin(angle)
}

@_cdecl("Cos")
public func Cos(_ angle: Float) -> Float {
    return cos(angle)
}

@_cdecl("Tan")
public func Tan(_ angle: Float) -> Float {
    return tan(angle)
}

@_cdecl("ASin")
public func ASin(_ value: Float) -> Float {
    return asin(value)
}

@_cdecl("ACos")
public func ACos(_ value: Float) -> Float {
    return acos(value)
}

@_cdecl("ATan")
public func ATan(_ value: Float) -> Float {
    return atan(value)
}

@_cdecl("ATan2")
public func ATan2(_ y: Float, _ x: Float) -> Float {
    return atan2(y, x)
}

// MARK: - Arithmetic Functions

@_cdecl("Sqrt")
public func Sqrt(_ value: Float) -> Float {
    return sqrt(value)
}

@_cdecl("Sqr")
public func Sqr(_ value: Float) -> Float {
    return value * value
}

@_cdecl("Abs")
public func Abs(_ value: Float) -> Float {
    return abs(value)
}

@_cdecl("AbsInt")
public func AbsInt(_ value: Int32) -> Int32 {
    return abs(value)
}

@_cdecl("Sgn")
public func Sgn(_ value: Float) -> Int32 {
    if value > 0 { return 1 }
    if value < 0 { return -1 }
    return 0
}

@_cdecl("Floor")
public func Floor(_ value: Float) -> Float {
    return floor(value)
}

@_cdecl("Ceil")
public func Ceil(_ value: Float) -> Float {
    return ceil(value)
}

@_cdecl("Exp")
public func Exp(_ value: Float) -> Float {
    return exp(value)
}

@_cdecl("Log")
public func Log(_ value: Float) -> Float {
    return log(value)
}

@_cdecl("Log10")
public func Log10(_ value: Float) -> Float {
    return log10(value)
}

// MARK: - Random Functions

@_cdecl("Rand")
@MainActor
public func Rand(_ min: Int32, _ max: Int32) -> Int32 {
    return MathManager.shared.rand(min: min, max: max)
}

@_cdecl("Rnd")
@MainActor
public func Rnd(_ scale: Float) -> Float {
    return MathManager.shared.rnd(scale: scale)
}

@_cdecl("SeedRnd")
@MainActor
public func SeedRnd(_ seed: Int32) {
    MathManager.shared.seedRnd(seed)
}

// MARK: - Utility Functions

@_cdecl("Min")
public func Min(_ a: Float, _ b: Float) -> Float {
    return min(a, b)
}

@_cdecl("MinInt")
public func MinInt(_ a: Int32, _ b: Int32) -> Int32 {
    return min(a, b)
}

@_cdecl("Max")
public func Max(_ a: Float, _ b: Float) -> Float {
    return max(a, b)
}

@_cdecl("MaxInt")
public func MaxInt(_ a: Int32, _ b: Int32) -> Int32 {
    return max(a, b)
}

@_cdecl("Mod")
public func Mod(_ a: Int32, _ b: Int32) -> Int32 {
    guard b != 0 else { return 0 }
    return a % b
}

@_cdecl("ModFloat")
public func ModFloat(_ a: Float, _ b: Float) -> Float {
    guard b != 0 else { return 0 }
    return a.truncatingRemainder(dividingBy: b)
}

// MARK: - Conversion Functions

@_cdecl("Int")
public func Int(_ value: Float) -> Int32 {
    return Int32(value)
}

@_cdecl("Float")
public func Float_(_ value: Int32) -> Float {
    return Float(value)
}

// MARK: - Power Function

@_cdecl("Pow")
public func Pow(_ base: Float, _ exponent: Float) -> Float {
    return pow(base, exponent)
}
