//
//  MathTests.swift
//  Blitz3DEngineTests
//
//  Unit tests for Math functions
//

import XCTest
@testable import Blitz3DEngineWASM

final class MathTests: XCTestCase {
    
    // MARK: - Trigonometric Tests
    
    func testSin() {
        XCTAssertEqual(Sin(0), 0, accuracy: 0.001)
        XCTAssertEqual(Sin(Float.pi / 2), 1, accuracy: 0.001)
        XCTAssertEqual(Sin(Float.pi), 0, accuracy: 0.001)
        XCTAssertEqual(Sin(3 * Float.pi / 2), -1, accuracy: 0.001)
    }
    
    func testCos() {
        XCTAssertEqual(Cos(0), 1, accuracy: 0.001)
        XCTAssertEqual(Cos(Float.pi / 2), 0, accuracy: 0.001)
        XCTAssertEqual(Cos(Float.pi), -1, accuracy: 0.001)
        XCTAssertEqual(Cos(2 * Float.pi), 1, accuracy: 0.001)
    }
    
    func testTan() {
        XCTAssertEqual(Tan(0), 0, accuracy: 0.001)
        XCTAssertEqual(Tan(Float.pi / 4), 1, accuracy: 0.001)
        XCTAssertEqual(Tan(Float.pi), 0, accuracy: 0.001)
    }
    
    func testASin() {
        XCTAssertEqual(ASin(0), 0, accuracy: 0.001)
        XCTAssertEqual(ASin(1), Float.pi / 2, accuracy: 0.001)
        XCTAssertEqual(ASin(-1), -Float.pi / 2, accuracy: 0.001)
    }
    
    func testACos() {
        XCTAssertEqual(ACos(1), 0, accuracy: 0.001)
        XCTAssertEqual(ACos(0), Float.pi / 2, accuracy: 0.001)
        XCTAssertEqual(ACos(-1), Float.pi, accuracy: 0.001)
    }
    
    func testATan() {
        XCTAssertEqual(ATan(0), 0, accuracy: 0.001)
        XCTAssertEqual(ATan(1), Float.pi / 4, accuracy: 0.001)
        XCTAssertEqual(ATan(-1), -Float.pi / 4, accuracy: 0.001)
    }
    
    func testATan2() {
        XCTAssertEqual(ATan2(0, 1), 0, accuracy: 0.001)
        XCTAssertEqual(ATan2(1, 0), Float.pi / 2, accuracy: 0.001)
        XCTAssertEqual(ATan2(0, -1), Float.pi, accuracy: 0.001)
        XCTAssertEqual(ATan2(-1, 0), -Float.pi / 2, accuracy: 0.001)
    }
    
    // MARK: - Arithmetic Tests
    
    func testSqrt() {
        XCTAssertEqual(Sqrt(0), 0, accuracy: 0.001)
        XCTAssertEqual(Sqrt(4), 2, accuracy: 0.001)
        XCTAssertEqual(Sqrt(9), 3, accuracy: 0.001)
        XCTAssertEqual(Sqrt(2), 1.414, accuracy: 0.001)
    }
    
    func testSqr() {
        XCTAssertEqual(Sqr(0), 0, accuracy: 0.001)
        XCTAssertEqual(Sqr(2), 4, accuracy: 0.001)
        XCTAssertEqual(Sqr(3), 9, accuracy: 0.001)
        XCTAssertEqual(Sqr(-5), 25, accuracy: 0.001)
    }
    
    func testAbs() {
        XCTAssertEqual(Abs(0), 0, accuracy: 0.001)
        XCTAssertEqual(Abs(5), 5, accuracy: 0.001)
        XCTAssertEqual(Abs(-5), 5, accuracy: 0.001)
        XCTAssertEqual(Abs(3.14), 3.14, accuracy: 0.001)
        XCTAssertEqual(Abs(-3.14), 3.14, accuracy: 0.001)
    }
    
    func testAbsInt() {
        XCTAssertEqual(AbsInt(0), 0)
        XCTAssertEqual(AbsInt(5), 5)
        XCTAssertEqual(AbsInt(-5), 5)
        XCTAssertEqual(AbsInt(100), 100)
        XCTAssertEqual(AbsInt(-100), 100)
    }
    
    func testSgn() {
        XCTAssertEqual(Sgn(0), 0)
        XCTAssertEqual(Sgn(5), 1)
        XCTAssertEqual(Sgn(-5), -1)
        XCTAssertEqual(Sgn(0.001), 1)
        XCTAssertEqual(Sgn(-0.001), -1)
    }
    
    func testFloor() {
        XCTAssertEqual(Floor(0), 0, accuracy: 0.001)
        XCTAssertEqual(Floor(3.7), 3, accuracy: 0.001)
        XCTAssertEqual(Floor(3.2), 3, accuracy: 0.001)
        XCTAssertEqual(Floor(-3.2), -4, accuracy: 0.001)
        XCTAssertEqual(Floor(-3.7), -4, accuracy: 0.001)
    }
    
    func testCeil() {
        XCTAssertEqual(Ceil(0), 0, accuracy: 0.001)
        XCTAssertEqual(Ceil(3.2), 4, accuracy: 0.001)
        XCTAssertEqual(Ceil(3.7), 4, accuracy: 0.001)
        XCTAssertEqual(Ceil(-3.7), -3, accuracy: 0.001)
        XCTAssertEqual(Ceil(-3.2), -3, accuracy: 0.001)
    }
    
    func testExp() {
        XCTAssertEqual(Exp(0), 1, accuracy: 0.001)
        XCTAssertEqual(Exp(1), 2.718, accuracy: 0.001)
        XCTAssertEqual(Exp(2), 7.389, accuracy: 0.001)
    }
    
    func testLog() {
        XCTAssertEqual(Log(1), 0, accuracy: 0.001)
        XCTAssertEqual(Log(2.718), 1, accuracy: 0.001)
        XCTAssertEqual(Log(7.389), 2, accuracy: 0.001)
    }
    
    func testLog10() {
        XCTAssertEqual(Log10(1), 0, accuracy: 0.001)
        XCTAssertEqual(Log10(10), 1, accuracy: 0.001)
        XCTAssertEqual(Log10(100), 2, accuracy: 0.001)
        XCTAssertEqual(Log10(1000), 3, accuracy: 0.001)
    }
    
    // MARK: - Random Tests
    
    @MainActor
    func testRand() {
        // Test range [0, 10]
        for _ in 0..<100 {
            let value = Rand(0, 10)
            XCTAssertGreaterThanOrEqual(value, 0)
            XCTAssertLessThanOrEqual(value, 10)
        }
        
        // Test range [5, 15]
        for _ in 0..<100 {
            let value = Rand(5, 15)
            XCTAssertGreaterThanOrEqual(value, 5)
            XCTAssertLessThanOrEqual(value, 15)
        }
        
        // Test negative range
        for _ in 0..<100 {
            let value = Rand(-10, -5)
            XCTAssertGreaterThanOrEqual(value, -10)
            XCTAssertLessThanOrEqual(value, -5)
        }
    }
    
    @MainActor
    func testRnd() {
        // Test range [0, 1)
        for _ in 0..<100 {
            let value = Rnd(1.0)
            XCTAssertGreaterThanOrEqual(value, 0.0)
            XCTAssertLessThan(value, 1.0)
        }
        
        // Test range [0, 10)
        for _ in 0..<100 {
            let value = Rnd(10.0)
            XCTAssertGreaterThanOrEqual(value, 0.0)
            XCTAssertLessThan(value, 10.0)
        }
    }
    
    @MainActor
    func testSeedRnd() {
        // Test deterministic behavior with seed
        SeedRnd(12345)
        let value1 = Rand(0, 1000)
        let value2 = Rand(0, 1000)
        
        // Reset with same seed
        SeedRnd(12345)
        let value3 = Rand(0, 1000)
        let value4 = Rand(0, 1000)
        
        // Should get same sequence
        XCTAssertEqual(value1, value3)
        XCTAssertEqual(value2, value4)
    }
    
    // MARK: - Utility Tests
    
    func testMin() {
        XCTAssertEqual(Min(1, 2), 1, accuracy: 0.001)
        XCTAssertEqual(Min(2, 1), 1, accuracy: 0.001)
        XCTAssertEqual(Min(-1, -2), -2, accuracy: 0.001)
        XCTAssertEqual(Min(0, 0), 0, accuracy: 0.001)
    }
    
    func testMinInt() {
        XCTAssertEqual(MinInt(1, 2), 1)
        XCTAssertEqual(MinInt(2, 1), 1)
        XCTAssertEqual(MinInt(-1, -2), -2)
        XCTAssertEqual(MinInt(0, 0), 0)
    }
    
    func testMax() {
        XCTAssertEqual(Max(1, 2), 2, accuracy: 0.001)
        XCTAssertEqual(Max(2, 1), 2, accuracy: 0.001)
        XCTAssertEqual(Max(-1, -2), -1, accuracy: 0.001)
        XCTAssertEqual(Max(0, 0), 0, accuracy: 0.001)
    }
    
    func testMaxInt() {
        XCTAssertEqual(MaxInt(1, 2), 2)
        XCTAssertEqual(MaxInt(2, 1), 2)
        XCTAssertEqual(MaxInt(-1, -2), -1)
        XCTAssertEqual(MaxInt(0, 0), 0)
    }
    
    func testMod() {
        XCTAssertEqual(Mod(10, 3), 1)
        XCTAssertEqual(Mod(15, 4), 3)
        XCTAssertEqual(Mod(8, 2), 0)
        XCTAssertEqual(Mod(7, 7), 0)
        XCTAssertEqual(Mod(5, 0), 0)  // Division by zero returns 0
    }
    
    func testModFloat() {
        XCTAssertEqual(ModFloat(10.5, 3.0), 1.5, accuracy: 0.001)
        XCTAssertEqual(ModFloat(15.7, 4.0), 3.7, accuracy: 0.001)
        XCTAssertEqual(ModFloat(8.0, 2.0), 0.0, accuracy: 0.001)
        XCTAssertEqual(ModFloat(5.0, 0.0), 0.0, accuracy: 0.001)  // Division by zero returns 0
    }
    
    func testPow() {
        XCTAssertEqual(Pow(2, 3), 8, accuracy: 0.001)
        XCTAssertEqual(Pow(3, 2), 9, accuracy: 0.001)
        XCTAssertEqual(Pow(5, 0), 1, accuracy: 0.001)
        XCTAssertEqual(Pow(2, 0.5), 1.414, accuracy: 0.001)  // sqrt(2)
    }
    
    // MARK: - Conversion Tests
    
    func testInt() {
        XCTAssertEqual(Int(3.7), 3)
        XCTAssertEqual(Int(3.2), 3)
        XCTAssertEqual(Int(-3.7), -3)
        XCTAssertEqual(Int(-3.2), -3)
        XCTAssertEqual(Int(0.0), 0)
    }
    
    func testFloat() {
        XCTAssertEqual(Float_(0), 0.0, accuracy: 0.001)
        XCTAssertEqual(Float_(5), 5.0, accuracy: 0.001)
        XCTAssertEqual(Float_(-5), -5.0, accuracy: 0.001)
        XCTAssertEqual(Float_(100), 100.0, accuracy: 0.001)
    }
}
