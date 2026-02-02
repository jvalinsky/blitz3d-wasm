import JavaScriptKit
import JavaScriptEventLoop

// Get JS Global scope
let jsg = JSObject.global

// Get DOM elements
let document = jsg.document
let editorEl = document.getElementById("editor")
let outputEl = document.getElementById("output")
let runButton = document.querySelector(".btn-primary")

// Track compiler state
var isCompilerLoaded = false

// Simple runtime imports for compiled code
var runtimeImports: [String: JSValue] = [
    "Print": JSValue.object(JSClosure { args in
        if args.count > 0 {
            let text = args[0].description
            printToDOM(text, type: "success")
        }
        return JSValue.undefined
    })
]

func printToDOM(_ text: String, type: String) {
    let div = document.createElement("div")
    div.className = JSValue.string("output-line \(type)")
    div.innerText = JSValue.string(text)
    _ = outputEl.appendChild(div)
}

func updateStatus(_ text: String, ready: Bool) {
    let statusText = document.getElementById("status-text")
    if statusText.isUndefined == false {
        statusText.innerText = JSValue.string(text)
    }
    let indicator = document.getElementById("status-indicator")
    if indicator.isUndefined == false {
        let className = ready ? "status-indicator status-ready" : "status-indicator status-error"
        indicator.className = JSValue.string(className)
    }
}

// Load compiler WASM
func loadCompiler() async {
    printToDOM("Loading compiler...", type: "info")
    
    do {
        let fetch = jsg.fetch
        let fetchResult = fetch.function!(JSValue.string("./blitz3d-compiler.wasm"))
        let promise = JSPromise(fetchResult.object!)
        let response = try await promise!.value
        
        let arrayBufferResult = response.arrayBuffer.function!()
        let arrayBufferPromise = JSPromise(arrayBufferResult.object!)
        let arrayBuffer = try await arrayBufferPromise!.value
        
        let WebAssembly = jsg.WebAssembly
        let moduleResult = WebAssembly.Module.function!(arrayBuffer)
        _ = moduleResult.object!
        
        isCompilerLoaded = true
        printToDOM("Compiler loaded successfully!", type: "success")
        updateStatus("Ready", ready: true)
        
    } catch {
        printToDOM("Failed to load compiler: \(error)", type: "error")
        updateStatus("Error", ready: false)
    }
}

// Compile Blitz3D code and return result
func compileBlitz3D(source: String) async -> CompileResult {
    guard isCompilerLoaded else {
        return CompileResult(success: false, error: "Compiler not loaded yet")
    }
    
    // Call the JavaScript compile function that will handle the WASM compiler
    let compileJS = jsg.compileBlitz3DJS
    if compileJS.isUndefined {
        return CompileResult(success: false, error: "JavaScript compiler bridge not available")
    }
    
    let resultJS = compileJS.function!(JSValue.string(source))
    guard let resultJSON = resultJS.string else {
        return CompileResult(success: false, error: "No result from compiler")
    }
    
    // Parse JSON result - JSON.parse returns a JSValue
    let parsed = JSObject.global.JSON.parse(JSValue.string(resultJSON))
    
    // Convert to JSObject to access properties
    guard let jsonObj = parsed.object else {
        return CompileResult(success: false, error: "Failed to parse JSON result")
    }
    
    // Access properties using dynamic member lookup
    // Need to explicitly type the variable to help type inference
    let successVal: JSValue = (jsonObj as JSObject).success
    let errorVal: JSValue = (jsonObj as JSObject).error
    let wasmVal: JSValue = (jsonObj as JSObject).wasm
    let sizeVal: JSValue = (jsonObj as JSObject).size
    
    if let isSuccess = successVal.boolean, isSuccess {
        if let wasm = wasmVal.string {
            return CompileResult(
                success: true,
                wasm: wasm,
                size: Int(sizeVal.number ?? 0)
            )
        }
    }
    
    return CompileResult(
        success: false,
        error: errorVal.string ?? "Unknown compilation error"
    )
}

// Compile result structure
struct CompileResult {
    let success: Bool
    let wasm: String?
    let size: Int
    let error: String?
    
    init(success: Bool, wasm: String? = nil, size: Int = 0, error: String? = nil) {
        self.success = success
        self.wasm = wasm
        self.size = size
        self.error = error
    }
}

// Main execution flow
func runCode() {
    guard let source = editorEl.value.string else {
        printToDOM("Could not get source from editor.", type: "error")
        return
    }
    
    if source.isEmpty {
        printToDOM("Please enter some code to run.", type: "error")
        return
    }
    
    printToDOM("Compiling...", type: "info")
    
    Task {
        let result = await compileBlitz3D(source: source)
        printToDOM("Result: \(result)", type: "info")
    }
}

// Main entry point
func main() {
    printToDOM("Swift interpreter starting...", type: "info")
    
    // Load compiler in background
    Task {
        await loadCompiler()
    }
    
    // Set up Run button
    let runClosure = JSClosure { _ in
        runCode()
        return JSValue.undefined
    }
    runButton.onclick = JSValue.object(runClosure)
    
    printToDOM("Ready. Enter Blitz3D code and click Run.", type: "info")
}

// Start
main()
