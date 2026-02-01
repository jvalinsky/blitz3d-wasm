//
//  WebAPIIntegration.swift
//  Blitz3DEngine
//
//  Web browser API integration for system queries using JavaScriptKit
//

import Foundation

#if arch(wasm32)
import JavaScriptKit

/// Estimates VRAM based on GPU renderer string from WebGL
func estimateVRAM(for renderer: String) -> Int32 {
    let lower = renderer.lowercased()
    
    // NVIDIA RTX 40 series
    if lower.contains("rtx 4090") { return 24576 } // 24GB
    if lower.contains("rtx 4080") { return 16384 } // 16GB
    if lower.contains("rtx 4070") { return 12288 } // 12GB
    if lower.contains("rtx 40") { return 12288 } // Default 12GB for RTX 40 series
    
    // NVIDIA RTX 30 series
    if lower.contains("rtx 3090") { return 24576 } // 24GB
    if lower.contains("rtx 3080") { return 10240 } // 10GB
    if lower.contains("rtx 3070") { return 8192 } // 8GB
    if lower.contains("rtx 30") { return 10240 } // Default 10GB for RTX 30 series
    
    // NVIDIA RTX 20 series
    if lower.contains("rtx 2080") { return 8192 } // 8GB
    if lower.contains("rtx 2070") { return 8192 } // 8GB
    if lower.contains("rtx 20") { return 8192 } // Default 8GB for RTX 20 series
    
    // NVIDIA GTX 1000 series
    if lower.contains("gtx 1080") { return 8192 } // 8GB
    if lower.contains("gtx 1070") { return 8192 } // 8GB
    if lower.contains("gtx 1060") { return 6144 } // 6GB
    if lower.contains("gtx 10") { return 4096 } // Default 4GB for GTX 10 series
    
    // AMD RX 7000 series (RDNA 3)
    if lower.contains("rx 7900") { return 20480 } // 20GB
    if lower.contains("rx 7800") { return 16384 } // 16GB
    if lower.contains("rx 7") { return 12288 } // Default 12GB for RX 7000 series
    
    // AMD RX 6000 series (RDNA 2)
    if lower.contains("rx 6900") { return 16384 } // 16GB
    if lower.contains("rx 6800") { return 16384 } // 16GB
    if lower.contains("rx 6700") { return 12288 } // 12GB
    if lower.contains("rx 6") { return 8192 } // Default 8GB for RX 6000 series
    
    // AMD RX 5000 series (RDNA)
    if lower.contains("rx 5") { return 8192 } // 8GB typical
    
    // Intel Arc
    if lower.contains("arc a7") { return 16384 } // 16GB
    if lower.contains("arc a5") { return 8192 } // 8GB
    if lower.contains("arc") { return 6144 } // 6GB default
    
    // Intel Integrated Graphics
    if lower.contains("intel") {
        if lower.contains("iris xe") || lower.contains("iris plus") {
            return 2048 // 2GB for modern Iris
        }
        return 1024 // 1GB for older Intel HD/UHD
    }
    
    // AMD Integrated (Vega, RDNA)
    if lower.contains("vega") || (lower.contains("radeon") && lower.contains("graphics")) {
        return 2048 // 2GB typical for APU graphics
    }
    
    // Apple Silicon (M1/M2/M3/M4)
    if lower.contains("apple") {
        if lower.contains("m4") { return 16384 } // 16GB+ for M4
        if lower.contains("m3") { return 12288 } // 12GB+ for M3
        if lower.contains("m2") { return 10240 } // 10GB+ for M2
        if lower.contains("m1") { return 8192 } // 8GB+ for M1
        return 2048 // iOS/iPad devices
    }
    
    // Qualcomm Adreno (Android/Mobile)
    if lower.contains("adreno") {
        if lower.contains("adreno 7") { return 1024 } // 1GB for newer Adreno
        if lower.contains("adreno 6") { return 512 } // 512MB for mid-range
        return 256 // 256MB for older mobile GPUs
    }
    
    // ARM Mali (Mobile)
    if lower.contains("mali") {
        return 512 // Typical for mobile
    }
    
    // Generic fallback - conservative 2GB
    return 2048
}

/// Gets GPU renderer string from WebGL debug info
func getGPURenderer() -> String {
    let document = JSObject.global.document
    guard let canvas = document.createElement("canvas").object else {
        return "Unknown GPU (no canvas)"
    }
    
    guard let gl = canvas.getContext("webgl").object else {
        return "Unknown GPU (no WebGL)"
    }
    
    // Get the WEBGL_debug_renderer_info extension
    guard let debugInfo = gl.getExtension("WEBGL_debug_renderer_info").object else {
        return "Unknown GPU (no debug info)"
    }
    
    // Get the unmasked renderer string
    let rendererParam = JSValue.number(0x9246) // UNMASKED_RENDERER_WEBGL
    guard let renderer = gl.getParameter(rendererParam).string else {
        return "Unknown GPU (no renderer string)"
    }
    
    return renderer
}

/// Gets total system RAM in GB from navigator.deviceMemory
func getSystemRAMGB() -> Double {
    let navigator = JSObject.global.navigator
    
    // navigator.deviceMemory returns RAM in GB (rounded to 2, 4, 8, etc.)
    if let memory = navigator.deviceMemory.number {
        return memory
    }
    
    // Fallback: Not available in Firefox/Safari - assume 4GB
    return 4.0
}

/// Gets JavaScript heap usage statistics from performance.memory
func getJSHeapStats() -> (used: Int64, limit: Int64) {
    let performance = JSObject.global.performance
    
    // Check if performance.memory exists (Chrome/Chromium only)
    guard performance.memory != .undefined else {
        // Not available in Firefox/Safari - estimate based on system RAM
        let ramGB = getSystemRAMGB()
        let estimatedLimit = Int64(ramGB * 0.5 * 1024 * 1024 * 1024) // 50% of RAM
        return (used: 0, limit: estimatedLimit)
    }
    
    let mem = performance.memory
    let used = Int64(mem.usedJSHeapSize.number ?? 0)
    let limit = Int64(mem.jsHeapSizeLimit.number ?? 0)
    
    return (used: used, limit: limit)
}

#else
// Native build implementations (macOS/Linux) - stubs for development

func estimateVRAM(for renderer: String) -> Int32 {
    return 2048 // 2GB default for native builds
}

func getGPURenderer() -> String {
    return "Native GPU (not WebGL)"
}

func getSystemRAMGB() -> Double {
    return 8.0 // 8GB default for native builds
}

func getJSHeapStats() -> (used: Int64, limit: Int64) {
    return (used: 0, limit: 8 * 1024 * 1024 * 1024) // 8GB default
}

#endif

// MARK: - Public Interface

/// Queries available VRAM using WebGL debug info
///
/// - Returns: Estimated available VRAM in megabytes
///
/// - Note: Uses WebGL renderer string to estimate GPU VRAM. Results are
///         heuristic-based and may not be perfectly accurate. Conservative
///         estimates are preferred to avoid memory issues.
public func queryAvailableVRAM() -> Int32 {
    let renderer = getGPURenderer()
    let vram = estimateVRAM(for: renderer)
    print("WebAPI: Detected GPU: \(renderer) -> \(vram)MB VRAM")
    return vram
}

/// Queries system memory statistics using Web APIs
///
/// - Returns: Tuple containing (totalRAM, availableRAM, memoryLoad)
///            - totalRAM: Total system RAM in bytes
///            - availableRAM: Available RAM estimate in bytes
///            - memoryLoad: Memory usage percentage (0-100)
///
/// - Note: Uses navigator.deviceMemory (total) and performance.memory (heap usage).
///         Results are approximate due to browser privacy restrictions.
public func querySystemMemory() -> (totalRAM: Int32, availableRAM: Int32, memoryLoad: Int32) {
    let totalRAMGB = getSystemRAMGB()
    let totalRAMBytes = Int32(totalRAMGB * 1024 * 1024 * 1024)
    
    let (usedHeap, heapLimit) = getJSHeapStats()
    
    // Available = heap limit - used heap
    let availableBytes = Int32(max(0, heapLimit - usedHeap))
    
    // Calculate memory load percentage based on JS heap pressure
    let load: Int32
    if heapLimit > 0 {
        load = Int32((Double(usedHeap) / Double(heapLimit)) * 100)
    } else {
        load = 50 // Default to 50% if unknown
    }
    
    let clampedLoad = min(100, max(0, load))
    
    print("WebAPI: System RAM: \(totalRAMGB)GB total, \(availableBytes / 1024 / 1024)MB available, \(clampedLoad)% load")
    
    return (totalRAM: totalRAMBytes, availableRAM: availableBytes, memoryLoad: clampedLoad)
}
