//
//  FileManager.swift
//  Blitz3DEngine
//
//  File I/O management for Blitz3D compatibility
//

import Foundation

/// File handle for tracking open files
public struct FileHandle {
    let id: Int32
    var position: Int
    var data: Data
    let mode: FileMode
    let path: String
    
    public enum FileMode {
        case read
        case write
        case readWrite
    }
}

/// Manages file operations for WASM interop
@MainActor
public class FileIOManager {
    public static let shared = FileIOManager()
    
    private var openFiles: [Int32: FileHandle] = [:]
    private var nextFileID: Int32 = 1
    
    // Directory enumeration state
    private var dirIterator: [String]?
    private var dirIteratorIndex: Int = 0
    
    private init() {}
    
    // MARK: - File Operations
    
    /// Open file for reading
    public func openFileRead(_ path: String) -> Int32 {
        // In WASM, files should be preloaded into VFS
        // This is a stub that will be connected to VFS
        let id = nextFileID
        nextFileID += 1
        
        openFiles[id] = FileHandle(
            id: id,
            position: 0,
            data: Data(), // VFS will provide actual data
            mode: .read,
            path: path
        )
        
        return id
    }
    
    /// Open file for writing
    public func openFileWrite(_ path: String) -> Int32 {
        let id = nextFileID
        nextFileID += 1
        
        openFiles[id] = FileHandle(
            id: id,
            position: 0,
            data: Data(),
            mode: .write,
            path: path
        )
        
        return id
    }
    
    /// Open file for reading and writing
    public func openFileReadWrite(_ path: String) -> Int32 {
        let id = nextFileID
        nextFileID += 1
        
        openFiles[id] = FileHandle(
            id: id,
            position: 0,
            data: Data(),
            mode: .readWrite,
            path: path
        )
        
        return id
    }
    
    /// Close file
    public func closeFile(_ id: Int32) {
        openFiles.removeValue(forKey: id)
    }
    
    /// Get current file position
    public func filePos(_ id: Int32) -> Int32 {
        guard let file = openFiles[id] else { return 0 }
        return Int32(file.position)
    }
    
    /// Seek to position in file
    public func seekFile(_ id: Int32, position: Int32) {
        guard var file = openFiles[id] else { return }
        file.position = max(0, min(Int(position), file.data.count))
        openFiles[id] = file
    }
    
    /// Check if at end of file
    public func eof(_ id: Int32) -> Int32 {
        guard let file = openFiles[id] else { return 1 }
        return file.position >= file.data.count ? 1 : 0
    }
    
    // MARK: - Read Operations
    
    /// Read a byte from file
    public func readByte(_ id: Int32) -> Int32 {
        guard var file = openFiles[id], file.position < file.data.count else { return 0 }
        let byte = file.data[file.position]
        file.position += 1
        openFiles[id] = file
        return Int32(byte)
    }
    
    /// Read a short (16-bit) from file
    public func readShort(_ id: Int32) -> Int32 {
        guard var file = openFiles[id], file.position + 1 < file.data.count else { return 0 }
        let value = file.data.withUnsafeBytes { bytes in
            bytes.load(fromByteOffset: file.position, as: Int16.self)
        }
        file.position += 2
        openFiles[id] = file
        return Int32(value)
    }
    
    /// Read an integer (32-bit) from file
    public func readInt(_ id: Int32) -> Int32 {
        guard var file = openFiles[id], file.position + 3 < file.data.count else { return 0 }
        let value = file.data.withUnsafeBytes { bytes in
            bytes.load(fromByteOffset: file.position, as: Int32.self)
        }
        file.position += 4
        openFiles[id] = file
        return value
    }
    
    /// Read a float from file
    public func readFloat(_ id: Int32) -> Float {
        guard var file = openFiles[id], file.position + 3 < file.data.count else { return 0.0 }
        let value = file.data.withUnsafeBytes { bytes in
            bytes.load(fromByteOffset: file.position, as: Float.self)
        }
        file.position += 4
        openFiles[id] = file
        return value
    }
    
    /// Read a line from file (until newline or EOF)
    public func readLine(_ id: Int32) -> String {
        guard var file = openFiles[id] else { return "" }
        
        var line = ""
        while file.position < file.data.count {
            let byte = file.data[file.position]
            file.position += 1
            
            if byte == 10 { // \n
                break
            } else if byte == 13 { // \r
                // Check for \r\n
                if file.position < file.data.count && file.data[file.position] == 10 {
                    file.position += 1
                }
                break
            }
            
            line.append(Character(UnicodeScalar(byte)))
        }
        
        openFiles[id] = file
        return line
    }
    
    /// Read a string from file (length-prefixed)
    public func readString(_ id: Int32) -> String {
        let length = readInt(id)
        guard length > 0, var file = openFiles[id] else { return "" }
        
        let endPos = min(file.position + Int(length), file.data.count)
        let stringData = file.data[file.position..<endPos]
        file.position = endPos
        openFiles[id] = file
        
        return String(data: stringData, encoding: .utf8) ?? ""
    }
    
    // MARK: - Write Operations
    
    /// Write a byte to file
    public func writeByte(_ id: Int32, value: Int32) {
        guard var file = openFiles[id] else { return }
        let byte = UInt8(value & 0xFF)
        
        if file.position >= file.data.count {
            file.data.append(byte)
        } else {
            file.data[file.position] = byte
        }
        file.position += 1
        openFiles[id] = file
    }
    
    /// Write a short (16-bit) to file
    public func writeShort(_ id: Int32, value: Int32) {
        guard var file = openFiles[id] else { return }
        var shortValue = Int16(value)
        let data = Data(bytes: &shortValue, count: 2)
        
        if file.position + 1 >= file.data.count {
            file.data.append(data)
        } else {
            file.data.replaceSubrange(file.position..<file.position+2, with: data)
        }
        file.position += 2
        openFiles[id] = file
    }
    
    /// Write an integer (32-bit) to file
    public func writeInt(_ id: Int32, value: Int32) {
        guard var file = openFiles[id] else { return }
        var intValue = value
        let data = Data(bytes: &intValue, count: 4)
        
        if file.position + 3 >= file.data.count {
            file.data.append(data)
        } else {
            file.data.replaceSubrange(file.position..<file.position+4, with: data)
        }
        file.position += 4
        openFiles[id] = file
    }
    
    /// Write a float to file
    public func writeFloat(_ id: Int32, value: Float) {
        guard var file = openFiles[id] else { return }
        var floatValue = value
        let data = Data(bytes: &floatValue, count: 4)
        
        if file.position + 3 >= file.data.count {
            file.data.append(data)
        } else {
            file.data.replaceSubrange(file.position..<file.position+4, with: data)
        }
        file.position += 4
        openFiles[id] = file
    }
    
    /// Write a line to file (with newline)
    public func writeLine(_ id: Int32, line: String) {
        writeString(id, string: line)
        writeByte(id, value: 10) // \n
    }
    
    /// Write a string to file (length-prefixed)
    public func writeString(_ id: Int32, string: String) {
        guard let data = string.data(using: .utf8) else { return }
        writeInt(id, value: Int32(data.count))
        
        guard var file = openFiles[id] else { return }
        if file.position >= file.data.count {
            file.data.append(data)
        } else {
            let endPos = min(file.position + data.count, file.data.count)
            file.data.replaceSubrange(file.position..<endPos, with: data)
        }
        file.position += data.count
        openFiles[id] = file
    }
    
    // MARK: - File Info Operations
    
    /// Get file size (in bytes)
    public func fileSize(_ path: String) -> Int32 {
        // This should query VFS in production
        return 0
    }
    
    /// Get file type (1=file, 2=directory, 0=not found)
    public func fileType(_ path: String) -> Int32 {
        // This should query VFS in production
        return 0
    }
    
    // MARK: - Directory Operations
    
    /// Read directory (start iteration)
    public func readDir(_ path: String) -> String {
        // This should query VFS in production
        dirIterator = []
        dirIteratorIndex = 0
        return ""
    }
    
    /// Get next file in directory iteration
    public func nextFile() -> String {
        guard let iterator = dirIterator, dirIteratorIndex < iterator.count else {
            return ""
        }
        let file = iterator[dirIteratorIndex]
        dirIteratorIndex += 1
        return file
    }
    
    /// Check if more files in directory iteration
    public func moreFiles() -> Int32 {
        guard let iterator = dirIterator else { return 0 }
        return dirIteratorIndex < iterator.count ? 1 : 0
    }
    
    /// Get current directory
    public func currentDir() -> String {
        return "/"
    }
    
    /// Change directory
    public func changeDir(_ path: String) -> Int32 {
        // Not implemented for WASM
        return 0
    }
    
    /// Create directory
    public func createDir(_ path: String) -> Int32 {
        // This should interact with VFS
        return 1
    }
    
    /// Delete directory
    public func deleteDir(_ path: String) -> Int32 {
        // This should interact with VFS
        return 1
    }
}
