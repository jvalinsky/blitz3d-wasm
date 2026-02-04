import Blitz3DCompiler
import Testing

struct WASMBinaryEncoderParallelTests {
    @Test func testParallelCodeSectionEncodingIsDeterministic() {
        var module = WASMModule()
        module.memories = [WASMMemory(initial: 1, maximum: 1)]
        module.exports.append(WASMExport(name: "memory", kind: .memory, index: 0))

        let type0 = WASMFunctionType(parameters: [], results: [.i32])
        module.types.append(type0)

        // Function section entries point to type indices.
        module.functions.append(0)
        module.functions.append(0)

        module.code.append(
            WASMFunction(
                typeIndex: 0,
                locals: [.i32, .i32, .f32],
                body: [
                    .i32Const(1),
                    .i32Const(2),
                    .i32Add,
                    .return
                ]
            )
        )
        module.code.append(
            WASMFunction(
                typeIndex: 0,
                locals: [],
                body: [
                    .i32Const(123),
                    .return
                ]
            )
        )

        var enc1 = WASMBinaryEncoder()
        enc1.jobs = 1
        let b1 = enc1.encode(module)

        var encAuto = WASMBinaryEncoder()
        encAuto.jobs = 0
        let bAuto = encAuto.encode(module)

        var enc4 = WASMBinaryEncoder()
        enc4.jobs = 4
        let b4 = enc4.encode(module)

        XCTAssertEqual(b1, bAuto)
        XCTAssertEqual(b1, b4)
    }
}
