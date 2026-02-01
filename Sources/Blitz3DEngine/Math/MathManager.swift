//
//  MathManager.swift
//  Blitz3DEngine
//
//  Math functions for Blitz3D compatibility
//

import Foundation

/// Manages random number generation state
public class MathManager {
    public static let shared = MathManager()
    
    private var randomGenerator: RandomNumberGenerator
    
    private init() {
        self.randomGenerator = SystemRandomGenerator()
    }
    
    /// Seed the random number generator
    public func seedRnd(_ seed: Int32) {
        self.randomGenerator = SeededRandomGenerator(seed: UInt64(bitPattern: Int64(seed)))
    }
    
    /// Generate random integer in range [min, max] inclusive
    public func rand(min: Int32, max: Int32) -> Int32 {
        guard min <= max else { return min }
        let range = UInt32(max - min + 1)
        let random = randomGenerator.next() % UInt64(range)
        return min + Int32(random)
    }
    
    /// Generate random float in range [0.0, scale)
    public func rnd(scale: Float) -> Float {
        let random = Float(randomGenerator.next()) / Float(UInt64.max)
        return random * scale
    }
}

/// System random number generator
private struct SystemRandomGenerator: RandomNumberGenerator {
    mutating func next() -> UInt64 {
        return UInt64.random(in: 0...UInt64.max)
    }
}

/// Seeded random number generator (Linear Congruential Generator)
private struct SeededRandomGenerator: RandomNumberGenerator {
    private var state: UInt64
    
    init(seed: UInt64) {
        // Use a non-zero seed (if seed is 0, use 1)
        self.state = seed == 0 ? 1 : seed
    }
    
    mutating func next() -> UInt64 {
        // LCG parameters from Numerical Recipes
        state = state &* 1664525 &+ 1013904223
        return state
    }
}
