//
//  SourceLocation.swift
//  Blitz3DCompiler
//

public struct SourceLocation: Equatable, Hashable, Codable, Sendable {
    public let line: Int
    public let column: Int
    public let sourceFile: String
    
    public init(line: Int, column: Int, sourceFile: String) {
        self.line = line
        self.column = column
        self.sourceFile = sourceFile
    }
    
    public static let unknown = SourceLocation(line: 0, column: 0, sourceFile: "unknown")
}

public struct SourceSpan: Equatable, Hashable, Codable, Sendable {
    public let start: SourceLocation
    public let end: SourceLocation
    
    public init(start: SourceLocation, end: SourceLocation) {
        self.start = start
        self.end = end
    }
    
    public init(start: SourceLocation) {
        self.start = start
        self.end = start
    }
    
    public static let unknown = SourceSpan(start: .unknown, end: .unknown)
}
