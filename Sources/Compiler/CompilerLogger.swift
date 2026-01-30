//
//  CompilerLogger.swift
//  Blitz3DCompiler
//
//  Lightweight logging utilities for compiler internals.
//

import Foundation

public enum CompilerLogLevel: Int, Comparable {
    case error = 0
    case warn = 1
    case info = 2
    case debug = 3
    case trace = 4

    public static func < (lhs: CompilerLogLevel, rhs: CompilerLogLevel) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
}

public enum CompilerLogger {
    /// Default to warnings to keep compiler output clean unless explicitly requested.
    public nonisolated(unsafe) static var level: CompilerLogLevel = .warn
    
    /// Serial queue for thread-safe logging
    private static let logQueue = DispatchQueue(label: "com.blitz3d.compiler.logger")

    public static func error(_ message: @autoclosure () -> String) {
        log(.error, message())
    }

    public static func warn(_ message: @autoclosure () -> String) {
        log(.warn, message())
    }

    public static func info(_ message: @autoclosure () -> String) {
        log(.info, message())
    }

    public static func debug(_ message: @autoclosure () -> String) {
        log(.debug, message())
    }

    public static func trace(_ message: @autoclosure () -> String) {
        log(.trace, message())
    }

    private static func log(_ at: CompilerLogLevel, _ message: String) {
        guard level >= at else { return }
        logQueue.sync {
            message + "\n"
        }
        if let data = (message + "\n").data(using: .utf8) {
            FileHandle.standardError.write(data)
        }
    }
}
