//
//  MathTests.swift
//  Blitz3DEngineTests
//
//  Unit tests for Math functions
//

import Testing
@testable import Blitz3DEngine

@inline(__always)
private func expectApprox(_ a: Float, _ b: Float, accuracy: Float = 0.001) {
    #expect(abs(a - b) <= accuracy)
}

// MARK: - Trigonometric

@Test func sin() {
    expectApprox(Sin(0), 0)
    expectApprox(Sin(Float.pi / 2), 1)
    expectApprox(Sin(Float.pi), 0)
    expectApprox(Sin(3 * Float.pi / 2), -1)
}

@Test func cos() {
    expectApprox(Cos(0), 1)
    expectApprox(Cos(Float.pi / 2), 0)
    expectApprox(Cos(Float.pi), -1)
    expectApprox(Cos(2 * Float.pi), 1)
}

@Test func tan() {
    expectApprox(Tan(0), 0)
    expectApprox(Tan(Float.pi / 4), 1)
    expectApprox(Tan(Float.pi), 0)
}

@Test func asin() {
    expectApprox(ASin(0), 0)
    expectApprox(ASin(1), Float.pi / 2)
    expectApprox(ASin(-1), -Float.pi / 2)
}

@Test func acos() {
    expectApprox(ACos(1), 0)
    expectApprox(ACos(0), Float.pi / 2)
    expectApprox(ACos(-1), Float.pi)
}

@Test func atan() {
    expectApprox(ATan(0), 0)
    expectApprox(ATan(1), Float.pi / 4)
    expectApprox(ATan(-1), -Float.pi / 4)
}

@Test func atan2() {
    expectApprox(ATan2(0, 1), 0)
    expectApprox(ATan2(1, 0), Float.pi / 2)
    expectApprox(ATan2(0, -1), Float.pi)
    expectApprox(ATan2(-1, 0), -Float.pi / 2)
}

// MARK: - Arithmetic

@Test func sqrt() {
    expectApprox(Sqrt(0), 0)
    expectApprox(Sqrt(4), 2)
    expectApprox(Sqrt(9), 3)
    expectApprox(Sqrt(2), 1.414)
}

@Test func sqr() {
    expectApprox(Sqr(0), 0)
    expectApprox(Sqr(2), 4)
    expectApprox(Sqr(3), 9)
    expectApprox(Sqr(-5), 25)
}

@Test func absFloat() {
    expectApprox(Abs(0), 0)
    expectApprox(Abs(5), 5)
    expectApprox(Abs(-5), 5)
    expectApprox(Abs(3.14), 3.14)
}

@Test func absInt() {
    #expect(AbsInt(0) == 0)
    #expect(AbsInt(5) == 5)
    #expect(AbsInt(-5) == 5)
    #expect(AbsInt(100) == 100)
}

@Test func sgn() {
    #expect(Sgn(5) == 1)
    #expect(Sgn(-5) == -1)
    #expect(Sgn(0) == 0)
    #expect(Sgn(0.001) == 1)
    #expect(Sgn(-0.001) == -1)
}

@Test func floor() {
    expectApprox(Floor(0), 0)
    expectApprox(Floor(3.7), 3)
    expectApprox(Floor(3.2), 3)
    expectApprox(Floor(-3.7), -4)
    expectApprox(Floor(-3.2), -4)
}

@Test func ceil() {
    expectApprox(Ceil(0), 0)
    expectApprox(Ceil(3.7), 4)
    expectApprox(Ceil(3.2), 4)
    expectApprox(Ceil(-3.7), -3)
    expectApprox(Ceil(-3.2), -3)
}

@Test func exp() {
    expectApprox(Exp(0), 1)
    expectApprox(Exp(1), 2.718)
    expectApprox(Exp(2), 7.389)
}

@Test func log() {
    expectApprox(Log(1), 0)
    expectApprox(Log(2.718), 1)
    expectApprox(Log(7.389), 2)
}

@Test func log10() {
    expectApprox(Log10(1), 0)
    expectApprox(Log10(10), 1)
    expectApprox(Log10(100), 2)
    expectApprox(Log10(1000), 3)
}

// MARK: - Random

@Test @MainActor func rand() {
    for _ in 0..<100 {
        let value = Rand(0, 10)
        #expect(value >= 0)
        #expect(value <= 10)
    }

    for _ in 0..<100 {
        let value = Rand(5, 15)
        #expect(value >= 5)
        #expect(value <= 15)
    }

    for _ in 0..<100 {
        let value = Rand(-10, -5)
        #expect(value >= -10)
        #expect(value <= -5)
    }
}

@Test @MainActor func rnd() {
    for _ in 0..<100 {
        let value = Rnd(1.0)
        #expect(value >= 0.0)
        #expect(value < 1.0)
    }

    for _ in 0..<100 {
        let value = Rnd(10.0)
        #expect(value >= 0.0)
        #expect(value < 10.0)
    }
}

@Test @MainActor func seedRnd() {
    SeedRnd(12345)
    let value1 = Rand(0, 1000)
    let value2 = Rand(0, 1000)

    SeedRnd(12345)
    let value3 = Rand(0, 1000)
    let value4 = Rand(0, 1000)

    #expect(value1 == value3)
    #expect(value2 == value4)
}

// MARK: - Utility

@Test func minFloat() {
    expectApprox(Min(1, 2), 1)
    expectApprox(Min(2, 1), 1)
    expectApprox(Min(-1, -2), -2)
    expectApprox(Min(0, 0), 0)
}

@Test func minInt() {
    #expect(MinInt(1, 2) == 1)
    #expect(MinInt(2, 1) == 1)
    #expect(MinInt(-1, -2) == -2)
    #expect(MinInt(0, 0) == 0)
}

@Test func maxFloat() {
    expectApprox(Max(1, 2), 2)
    expectApprox(Max(2, 1), 2)
    expectApprox(Max(-1, -2), -1)
    expectApprox(Max(0, 0), 0)
}

@Test func maxInt() {
    #expect(MaxInt(1, 2) == 2)
    #expect(MaxInt(2, 1) == 2)
    #expect(MaxInt(-1, -2) == -1)
    #expect(MaxInt(0, 0) == 0)
}

@Test func mod() {
    #expect(Mod(10, 3) == 1)
    #expect(Mod(15, 4) == 3)
    #expect(Mod(8, 2) == 0)
    #expect(Mod(7, 7) == 0)
    #expect(Mod(5, 0) == 0)
}

@Test func modFloat() {
    expectApprox(ModFloat(10.5, 3.0), 1.5)
    expectApprox(ModFloat(15.7, 4.0), 3.7)
    expectApprox(ModFloat(8.0, 2.0), 0.0)
    expectApprox(ModFloat(5.0, 0.0), 0.0)
}

@Test func pow() {
    expectApprox(Pow(2, 3), 8)
    expectApprox(Pow(3, 2), 9)
    expectApprox(Pow(5, 0), 1)
    expectApprox(Pow(2, 0.5), 1.414)
}

// MARK: - Conversion

@Test func intConversion() {
    #expect(Int(3.7) == 3)
    #expect(Int(3.2) == 3)
    #expect(Int(-3.7) == -3)
    #expect(Int(-3.2) == -3)
    #expect(Int(0.0) == 0)
}

@Test func floatConversion() {
    expectApprox(Float_(0), 0.0)
    expectApprox(Float_(5), 5.0)
    expectApprox(Float_(-5), -5.0)
    expectApprox(Float_(100), 100.0)
}
