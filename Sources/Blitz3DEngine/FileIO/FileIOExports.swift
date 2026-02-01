//
//  FileIOExports.swift
//  Blitz3DEngine
//
//  WASM exports for Blitz3D File I/O functions
//

import Foundation

// MARK: - File Operations

@_cdecl("ReadFile")
@MainActor
public func ReadFile(_ pathID: Int32) -> Int32 {
    guard let path = StringManager.shared.getString(pathID) else { return 0 }
    return FileIOManager.shared.openFileRead(path)
}

@_cdecl("WriteFile")
@MainActor
public func WriteFile(_ pathID: Int32) -> Int32 {
    guard let path = StringManager.shared.getString(pathID) else { return 0 }
    return FileIOManager.shared.openFileWrite(path)
}

@_cdecl("OpenFile")
@MainActor
public func OpenFile(_ pathID: Int32) -> Int32 {
    guard let path = StringManager.shared.getString(pathID) else { return 0 }
    return FileIOManager.shared.openFileReadWrite(path)
}

@_cdecl("CloseFile")
@MainActor
public func CloseFile(_ fileID: Int32) {
    FileIOManager.shared.closeFile(fileID)
}

@_cdecl("FilePos")
@MainActor
public func FilePos(_ fileID: Int32) -> Int32 {
    return FileIOManager.shared.filePos(fileID)
}

@_cdecl("SeekFile")
@MainActor
public func SeekFile(_ fileID: Int32, _ position: Int32) {
    FileIOManager.shared.seekFile(fileID, position: position)
}

@_cdecl("Eof")
@MainActor
public func Eof(_ fileID: Int32) -> Int32 {
    return FileIOManager.shared.eof(fileID)
}

// MARK: - Read Operations

@_cdecl("ReadByte")
@MainActor
public func ReadByte(_ fileID: Int32) -> Int32 {
    return FileIOManager.shared.readByte(fileID)
}

@_cdecl("ReadShort")
@MainActor
public func ReadShort(_ fileID: Int32) -> Int32 {
    return FileIOManager.shared.readShort(fileID)
}

@_cdecl("ReadInt")
@MainActor
public func ReadInt(_ fileID: Int32) -> Int32 {
    return FileIOManager.shared.readInt(fileID)
}

@_cdecl("ReadFloat")
@MainActor
public func ReadFloat(_ fileID: Int32) -> Float {
    return FileIOManager.shared.readFloat(fileID)
}

@_cdecl("ReadLine")
@MainActor
public func ReadLine(_ fileID: Int32) -> Int32 {
    let line = FileIOManager.shared.readLine(fileID)
    return StringManager.shared.storeString(line)
}

@_cdecl("ReadString")
@MainActor
public func ReadString(_ fileID: Int32) -> Int32 {
    let string = FileIOManager.shared.readString(fileID)
    return StringManager.shared.storeString(string)
}

// MARK: - Write Operations

@_cdecl("WriteByte")
@MainActor
public func WriteByte(_ fileID: Int32, _ value: Int32) {
    FileIOManager.shared.writeByte(fileID, value: value)
}

@_cdecl("WriteShort")
@MainActor
public func WriteShort(_ fileID: Int32, _ value: Int32) {
    FileIOManager.shared.writeShort(fileID, value: value)
}

@_cdecl("WriteInt")
@MainActor
public func WriteInt(_ fileID: Int32, _ value: Int32) {
    FileIOManager.shared.writeInt(fileID, value: value)
}

@_cdecl("WriteFloat")
@MainActor
public func WriteFloat(_ fileID: Int32, _ value: Float) {
    FileIOManager.shared.writeFloat(fileID, value: value)
}

@_cdecl("WriteLine")
@MainActor
public func WriteLine(_ fileID: Int32, _ lineID: Int32) {
    guard let line = StringManager.shared.getString(lineID) else { return }
    FileIOManager.shared.writeLine(fileID, line: line)
}

@_cdecl("WriteString")
@MainActor
public func WriteString(_ fileID: Int32, _ stringID: Int32) {
    guard let string = StringManager.shared.getString(stringID) else { return }
    FileIOManager.shared.writeString(fileID, string: string)
}

// MARK: - File Info

@_cdecl("FileSize")
@MainActor
public func FileSize(_ pathID: Int32) -> Int32 {
    guard let path = StringManager.shared.getString(pathID) else { return 0 }
    return FileIOManager.shared.fileSize(path)
}

@_cdecl("FileType")
@MainActor
public func FileType(_ pathID: Int32) -> Int32 {
    guard let path = StringManager.shared.getString(pathID) else { return 0 }
    return FileIOManager.shared.fileType(path)
}

// MARK: - Directory Operations

@_cdecl("ReadDir")
@MainActor
public func ReadDir(_ pathID: Int32) -> Int32 {
    guard let path = StringManager.shared.getString(pathID) else {
        return StringManager.shared.storeString("")
    }
    let result = FileIOManager.shared.readDir(path)
    return StringManager.shared.storeString(result)
}

@_cdecl("NextFile")
@MainActor
public func NextFile() -> Int32 {
    let file = FileIOManager.shared.nextFile()
    return StringManager.shared.storeString(file)
}

@_cdecl("MoreFiles")
@MainActor
public func MoreFiles() -> Int32 {
    return FileIOManager.shared.moreFiles()
}

@_cdecl("CurrentDir")
@MainActor
public func CurrentDir() -> Int32 {
    let dir = FileIOManager.shared.currentDir()
    return StringManager.shared.storeString(dir)
}

@_cdecl("ChangeDir")
@MainActor
public func ChangeDir(_ pathID: Int32) -> Int32 {
    guard let path = StringManager.shared.getString(pathID) else { return 0 }
    return FileIOManager.shared.changeDir(path)
}

@_cdecl("CreateDir")
@MainActor
public func CreateDir(_ pathID: Int32) -> Int32 {
    guard let path = StringManager.shared.getString(pathID) else { return 0 }
    return FileIOManager.shared.createDir(path)
}

@_cdecl("DeleteDir")
@MainActor
public func DeleteDir(_ pathID: Int32) -> Int32 {
    guard let path = StringManager.shared.getString(pathID) else { return 0 }
    return FileIOManager.shared.deleteDir(path)
}
