//
//  AssetLoader.swift
//  Blitz3DEngine
//
//  Graphics asset loading for Blitz3D compatibility
//

import Foundation

/// Manages loading of meshes, textures, and images
@MainActor
public class AssetLoader {
    public static let shared = AssetLoader()
    
    private var loadedMeshes: [Int32: MeshHandle] = [:]
    private var loadedTextures: [Int32: TextureHandle] = [:]
    private var loadedImages: [Int32: ImageHandle] = [:]
    
    private var nextMeshID: Int32 = 1
    private var nextTextureID: Int32 = 1
    private var nextImageID: Int32 = 1
    
    private init() {}
    
    // MARK: - Mesh Loading
    
    /// Load a mesh from file
    public func loadMesh(_ path: String, parent: Int32) -> Int32 {
        // Determine format from extension
        let lowercasePath = path.lowercased()
        
        if lowercasePath.hasSuffix(".b3d") {
            return loadB3DMesh(path, parent: parent)
        } else if lowercasePath.hasSuffix(".rmesh") || lowercasePath.hasSuffix(".rmes") {
            return loadRMeshMesh(path, parent: parent)
        } else if lowercasePath.hasSuffix(".x") {
            return loadXMesh(path, parent: parent)
        } else if lowercasePath.hasSuffix(".3ds") {
            return load3DSMesh(path, parent: parent)
        }
        
        return 0
    }
    
    /// Load B3D format mesh
    private func loadB3DMesh(_ path: String, parent: Int32) -> Int32 {
        // This will call the existing ParseB3D function
        // For now, return a stub mesh ID
        let id = nextMeshID
        nextMeshID += 1
        
        loadedMeshes[id] = MeshHandle(
            id: id,
            path: path,
            parent: parent,
            format: .b3d
        )
        
        return id
    }
    
    /// Load RMesh format mesh (SCPCB format)
    private func loadRMeshMesh(_ path: String, parent: Int32) -> Int32 {
        // This will call the existing ParseRMesh function
        let id = nextMeshID
        nextMeshID += 1
        
        loadedMeshes[id] = MeshHandle(
            id: id,
            path: path,
            parent: parent,
            format: .rmesh
        )
        
        return id
    }
    
    /// Load X format mesh
    private func loadXMesh(_ path: String, parent: Int32) -> Int32 {
        // X format support (DirectX .x files)
        let id = nextMeshID
        nextMeshID += 1
        
        loadedMeshes[id] = MeshHandle(
            id: id,
            path: path,
            parent: parent,
            format: .x
        )
        
        return id
    }
    
    /// Load 3DS format mesh
    private func load3DSMesh(_ path: String, parent: Int32) -> Int32 {
        // 3DS format support
        let id = nextMeshID
        nextMeshID += 1
        
        loadedMeshes[id] = MeshHandle(
            id: id,
            path: path,
            parent: parent,
            format: .threeDS
        )
        
        return id
    }
    
    /// Load animated mesh
    public func loadAnimMesh(_ path: String, parent: Int32) -> Int32 {
        // Load mesh with animation support
        return loadMesh(path, parent: parent)
    }
    
    /// Free a mesh
    public func freeMesh(_ id: Int32) {
        loadedMeshes.removeValue(forKey: id)
    }
    
    /// Get mesh info
    public func getMesh(_ id: Int32) -> MeshHandle? {
        return loadedMeshes[id]
    }
    
    // MARK: - Texture Loading
    
    /// Load a texture from file
    public func loadTexture(_ path: String, flags: Int32) -> Int32 {
        let id = nextTextureID
        nextTextureID += 1
        
        loadedTextures[id] = TextureHandle(
            id: id,
            path: path,
            flags: flags,
            width: 0,
            height: 0
        )
        
        return id
    }
    
    /// Load animated texture
    public func loadAnimTexture(_ path: String, flags: Int32, width: Int32, height: Int32, firstFrame: Int32, frameCount: Int32) -> Int32 {
        let id = nextTextureID
        nextTextureID += 1
        
        loadedTextures[id] = TextureHandle(
            id: id,
            path: path,
            flags: flags,
            width: Int(width),
            height: Int(height),
            frameCount: Int(frameCount)
        )
        
        return id
    }
    
    /// Create texture from memory
    public func createTexture(_ width: Int32, _ height: Int32, flags: Int32, frames: Int32) -> Int32 {
        let id = nextTextureID
        nextTextureID += 1
        
        loadedTextures[id] = TextureHandle(
            id: id,
            path: "",
            flags: flags,
            width: Int(width),
            height: Int(height),
            frameCount: Int(frames)
        )
        
        return id
    }
    
    /// Free a texture
    public func freeTexture(_ id: Int32) {
        loadedTextures.removeValue(forKey: id)
    }
    
    /// Get texture info
    public func getTexture(_ id: Int32) -> TextureHandle? {
        return loadedTextures[id]
    }
    
    /// Get texture width
    public func textureWidth(_ id: Int32) -> Int32 {
        guard let texture = loadedTextures[id] else { return 0 }
        return Int32(texture.width)
    }
    
    /// Get texture height
    public func textureHeight(_ id: Int32) -> Int32 {
        guard let texture = loadedTextures[id] else { return 0 }
        return Int32(texture.height)
    }
    
    /// Get texture name/path
    public func textureName(_ id: Int32) -> String {
        guard let texture = loadedTextures[id] else { return "" }
        return texture.path
    }
    
    // MARK: - Image Loading
    
    /// Load an image from file
    public func loadImage(_ path: String) -> Int32 {
        let id = nextImageID
        nextImageID += 1
        
        loadedImages[id] = ImageHandle(
            id: id,
            path: path,
            width: 0,
            height: 0
        )
        
        return id
    }
    
    /// Load animated image
    public func loadAnimImage(_ path: String, width: Int32, height: Int32, firstFrame: Int32, frameCount: Int32) -> Int32 {
        let id = nextImageID
        nextImageID += 1
        
        loadedImages[id] = ImageHandle(
            id: id,
            path: path,
            width: Int(width),
            height: Int(height),
            frameCount: Int(frameCount)
        )
        
        return id
    }
    
    /// Create image from memory
    public func createImage(_ width: Int32, _ height: Int32, frames: Int32) -> Int32 {
        let id = nextImageID
        nextImageID += 1
        
        loadedImages[id] = ImageHandle(
            id: id,
            path: "",
            width: Int(width),
            height: Int(height),
            frameCount: Int(frames)
        )
        
        return id
    }
    
    /// Copy an image
    public func copyImage(_ id: Int32) -> Int32 {
        guard let original = loadedImages[id] else { return 0 }
        
        let newID = nextImageID
        nextImageID += 1
        
        loadedImages[newID] = ImageHandle(
            id: newID,
            path: original.path,
            width: original.width,
            height: original.height,
            frameCount: original.frameCount
        )
        
        return newID
    }
    
    /// Free an image
    public func freeImage(_ id: Int32) {
        loadedImages.removeValue(forKey: id)
    }
    
    /// Get image info
    public func getImage(_ id: Int32) -> ImageHandle? {
        return loadedImages[id]
    }
    
    /// Get image width
    public func imageWidth(_ id: Int32) -> Int32 {
        guard let image = loadedImages[id] else { return 0 }
        return Int32(image.width)
    }
    
    /// Get image height
    public func imageHeight(_ id: Int32) -> Int32 {
        guard let image = loadedImages[id] else { return 0 }
        return Int32(image.height)
    }
}

// MARK: - Handle Structures

public struct MeshHandle {
    let id: Int32
    let path: String
    let parent: Int32
    let format: MeshFormat
    
    enum MeshFormat {
        case b3d
        case rmesh
        case x
        case threeDS
        case md2
    }
}

public struct TextureHandle {
    let id: Int32
    let path: String
    let flags: Int32
    let width: Int
    let height: Int
    var frameCount: Int = 1
}

public struct ImageHandle {
    let id: Int32
    let path: String
    let width: Int
    let height: Int
    var frameCount: Int = 1
}
