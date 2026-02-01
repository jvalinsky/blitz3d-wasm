//
//  GraphicsExports.swift
//  Blitz3DEngine
//
//  WASM exports for Blitz3D Graphics asset loading
//

import Foundation

// MARK: - Mesh Loading

@_cdecl("LoadMesh")
@MainActor
public func LoadMesh(_ pathID: Int32, _ parent: Int32) -> Int32 {
    guard let path = StringManager.shared.getString(pathID) else { return 0 }
    return AssetLoader.shared.loadMesh(path, parent: parent)
}

@_cdecl("LoadAnimMesh")
@MainActor
public func LoadAnimMesh(_ pathID: Int32, _ parent: Int32) -> Int32 {
    guard let path = StringManager.shared.getString(pathID) else { return 0 }
    return AssetLoader.shared.loadAnimMesh(path, parent: parent)
}

@_cdecl("FreeMesh")
@MainActor
public func FreeMesh(_ meshID: Int32) {
    AssetLoader.shared.freeMesh(meshID)
}

// MARK: - Texture Loading

@_cdecl("LoadTexture")
@MainActor
public func LoadTexture(_ pathID: Int32, _ flags: Int32) -> Int32 {
    guard let path = StringManager.shared.getString(pathID) else { return 0 }
    return AssetLoader.shared.loadTexture(path, flags: flags)
}

@_cdecl("LoadAnimTexture")
@MainActor
public func LoadAnimTexture(_ pathID: Int32, _ flags: Int32, _ width: Int32, _ height: Int32, _ firstFrame: Int32, _ frameCount: Int32) -> Int32 {
    guard let path = StringManager.shared.getString(pathID) else { return 0 }
    return AssetLoader.shared.loadAnimTexture(path, flags: flags, width: width, height: height, firstFrame: firstFrame, frameCount: frameCount)
}

// Note: CreateTexture and FreeTexture already defined in Exports.swift

@_cdecl("TextureWidth")
@MainActor
public func TextureWidth(_ textureID: Int32) -> Int32 {
    return AssetLoader.shared.textureWidth(textureID)
}

@_cdecl("TextureHeight")
@MainActor
public func TextureHeight(_ textureID: Int32) -> Int32 {
    return AssetLoader.shared.textureHeight(textureID)
}

@_cdecl("TextureName")
@MainActor
public func TextureName(_ textureID: Int32) -> Int32 {
    let name = AssetLoader.shared.textureName(textureID)
    return StringManager.shared.storeString(name)
}

// MARK: - Image Loading

@_cdecl("LoadImage")
@MainActor
public func LoadImage(_ pathID: Int32) -> Int32 {
    guard let path = StringManager.shared.getString(pathID) else { return 0 }
    return AssetLoader.shared.loadImage(path)
}

@_cdecl("LoadAnimImage")
@MainActor
public func LoadAnimImage(_ pathID: Int32, _ width: Int32, _ height: Int32, _ firstFrame: Int32, _ frameCount: Int32) -> Int32 {
    guard let path = StringManager.shared.getString(pathID) else { return 0 }
    return AssetLoader.shared.loadAnimImage(path, width: width, height: height, firstFrame: firstFrame, frameCount: frameCount)
}

// Note: CreateImage and FreeImage already defined in Exports.swift

@_cdecl("CopyImage")
@MainActor
public func CopyImage(_ imageID: Int32) -> Int32 {
    return AssetLoader.shared.copyImage(imageID)
}

@_cdecl("ImageWidth")
@MainActor
public func ImageWidth(_ imageID: Int32) -> Int32 {
    return AssetLoader.shared.imageWidth(imageID)
}

@_cdecl("ImageHeight")
@MainActor
public func ImageHeight(_ imageID: Int32) -> Int32 {
    return AssetLoader.shared.imageHeight(imageID)
}

// MARK: - Texture Operations

@_cdecl("TextureBlend")
@MainActor
public func TextureBlend(_ textureID: Int32, _ blend: Int32) {
    // Texture blending mode
    // This will be handled by the rendering system
}

@_cdecl("TextureCoords")
@MainActor
public func TextureCoords(_ textureID: Int32, _ coords: Int32) {
    // Texture coordinate mode
    // This will be handled by the rendering system
}

@_cdecl("ScaleTexture")
@MainActor
public func ScaleTexture(_ textureID: Int32, _ uScale: Float, _ vScale: Float) {
    // Texture scaling
    // This will be handled by the rendering system
}

@_cdecl("PositionTexture")
@MainActor
public func PositionTexture(_ textureID: Int32, _ u: Float, _ v: Float) {
    // Texture positioning
    // This will be handled by the rendering system
}

@_cdecl("RotateTexture")
@MainActor
public func RotateTexture(_ textureID: Int32, _ angle: Float) {
    // Texture rotation
    // This will be handled by the rendering system
}

@_cdecl("TextureFilter")
@MainActor
public func TextureFilter(_ filterID: Int32, _ flags: Int32) {
    // Texture filtering
    // This will be handled by the rendering system
}

// MARK: - Image Operations

@_cdecl("DrawImage")
@MainActor
public func DrawImage(_ imageID: Int32, _ x: Int32, _ y: Int32, _ frame: Int32) {
    // Draw image to screen
    // This will be handled by the 2D rendering system
}

@_cdecl("DrawImageRect")
@MainActor
public func DrawImageRect(_ imageID: Int32, _ x: Int32, _ y: Int32, _ rectX: Int32, _ rectY: Int32, _ rectWidth: Int32, _ rectHeight: Int32, _ frame: Int32) {
    // Draw image rectangle
    // This will be handled by the 2D rendering system
}

@_cdecl("DrawBlock")
@MainActor
public func DrawBlock(_ imageID: Int32, _ x: Int32, _ y: Int32, _ frame: Int32) {
    // Draw image block (no alpha)
    // This will be handled by the 2D rendering system
}

@_cdecl("TileImage")
@MainActor
public func TileImage(_ imageID: Int32, _ x: Int32, _ y: Int32, _ frame: Int32) {
    // Tile image
    // This will be handled by the 2D rendering system
}

@_cdecl("TileBlock")
@MainActor
public func TileBlock(_ imageID: Int32, _ x: Int32, _ y: Int32, _ frame: Int32) {
    // Tile block (no alpha)
    // This will be handled by the 2D rendering system
}

@_cdecl("HandleImage")
@MainActor
public func HandleImage(_ imageID: Int32, _ x: Int32, _ y: Int32) {
    // Set image handle point
    // This will be handled by the 2D rendering system
}

@_cdecl("MidHandle")
@MainActor
public func MidHandle(_ imageID: Int32) {
    // Set handle to center
    // This will be handled by the 2D rendering system
}

@_cdecl("AutoMidHandle")
@MainActor
public func AutoMidHandle(_ enable: Int32) {
    // Auto mid-handle for all images
    // This will be handled by the 2D rendering system
}

@_cdecl("MaskImage")
@MainActor
public func MaskImage(_ imageID: Int32, _ r: Int32, _ g: Int32, _ b: Int32) {
    // Set image mask color
    // This will be handled by the 2D rendering system
}

@_cdecl("ScaleImage")
@MainActor
public func ScaleImage(_ imageID: Int32, _ xScale: Float, _ yScale: Float) {
    // Scale image
    // This will be handled by the 2D rendering system
}

@_cdecl("ResizeImage")
@MainActor
public func ResizeImage(_ imageID: Int32, _ width: Int32, _ height: Int32) {
    // Resize image
    // This will be handled by the 2D rendering system
}

@_cdecl("RotateImage")
@MainActor
public func RotateImage(_ imageID: Int32, _ angle: Float) {
    // Rotate image
    // This will be handled by the 2D rendering system
}

@_cdecl("TFormImage")
@MainActor
public func TFormImage(_ imageID: Int32, _ a: Float, _ b: Float, _ c: Float, _ d: Float) {
    // Transform image matrix
    // This will be handled by the 2D rendering system
}

@_cdecl("TFormFilter")
@MainActor
public func TFormFilter(_ enable: Int32) {
    // Enable/disable transform filtering
    // This will be handled by the 2D rendering system
}

@_cdecl("GrabImage")
@MainActor
public func GrabImage(_ imageID: Int32, _ x: Int32, _ y: Int32, _ frame: Int32) {
    // Grab image from screen
    // This will be handled by the 2D rendering system
}

@_cdecl("ImageRectOverlap")
@MainActor
public func ImageRectOverlap(_ image1: Int32, _ x1: Int32, _ y1: Int32, _ image2: Int32, _ x2: Int32, _ y2: Int32) -> Int32 {
    // Check image rectangle overlap
    return 0
}

@_cdecl("ImageRectCollide")
@MainActor
public func ImageRectCollide(_ image1: Int32, _ x1: Int32, _ y1: Int32, _ frame1: Int32, _ image2: Int32, _ x2: Int32, _ y2: Int32, _ frame2: Int32) -> Int32 {
    // Check image collision
    return 0
}

@_cdecl("RectsOverlap")
@MainActor
public func RectsOverlap(_ x1: Int32, _ y1: Int32, _ w1: Int32, _ h1: Int32, _ x2: Int32, _ y2: Int32, _ w2: Int32, _ h2: Int32) -> Int32 {
    // Check rectangle overlap
    let overlap = !(x1 + w1 <= x2 || x2 + w2 <= x1 || y1 + h1 <= y2 || y2 + h2 <= y1)
    return overlap ? 1 : 0
}

@_cdecl("ImagesOverlap")
@MainActor
public func ImagesOverlap(_ image1: Int32, _ x1: Int32, _ y1: Int32, _ image2: Int32, _ x2: Int32, _ y2: Int32) -> Int32 {
    // Check image overlap
    return 0
}

@_cdecl("ImagesCollide")
@MainActor
public func ImagesCollide(_ image1: Int32, _ x1: Int32, _ y1: Int32, _ frame1: Int32, _ image2: Int32, _ x2: Int32, _ y2: Int32, _ frame2: Int32) -> Int32 {
    // Check image collision (pixel-perfect)
    return 0
}
