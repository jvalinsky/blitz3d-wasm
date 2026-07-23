# Compiler Architecture

This diagram illustrates the flow of data through the Blitz3D-to-WASM compiler
pipeline.

```mermaid
graph TD
    subgraph Input
        SRC[Source Code .bb] --> PRE[Preprocessor]
        INC[Variables/Includes] --> PRE
    end

    subgraph Compiler Core
        PRE -->|Clean Source| LEX[Lexer]
        LEX -->|Token Stream| PAR[Parser]
        PAR -->|AST| LOW[Lowering]
        
        subgraph "Middle End"
            LOW -->|Symbol Table| SYM[Symbols]
            LOW -->|Type Coercion| TYP[Type System]
            LOW -->|Desugaring| IR_GEN[IR Generation]
        end
        
        IR_GEN -->|SimpleIR| CG[CodeGen]
    end

    subgraph "Back End (WASM)"
        CG -->|WASM Instructions| WASM_MOD[WASM Module]
        WASM_MOD -->|Serialize| BIN[.wasm Binary]
        WASM_MOD -->|Serialize| WAT[.wat Text]
    end

    subgraph Runtime
        BIN -->|Load| BR[Browser]
        JS[Runtime.js] -->|Imports| BR
        
        subgraph "Runtime Modules"
            JS --> GFX[Graphics]
            JS --> AUD[Audio]
            JS --> INP[Input]
            JS --> FS[FileSystem]
        end
    end

    %% Styles
    style PRE fill:#f9f,stroke:#333,stroke-width:2px
    style PAR fill:#bbf,stroke:#333,stroke-width:2px
    style LOW fill:#dfd,stroke:#333,stroke-width:2px
    style CG fill:#fdd,stroke:#333,stroke-width:2px
    style BR fill:#ddf,stroke:#333,stroke-width:4px
```

## Component Roles

1. **Preprocessor**: Resolves `#Include` paths and normalizes text encoding
   (Windows-1252 -> UTF-8).
2. **Lexer**: Tokenizes the raw text (Identifier, Keyword, Literal).
3. **Parser**: Builds the **Abstract Syntax Tree (AST)**. Validates syntax
   (e.g., `If` must have `EndIf`).
4. **Lowering**: The heavy lifter.
   - **Features**: Type checking, implicit casting (`coerce`), array allocation
     (`__Alloc`), and control flow simplification.
   - **Output**: **Intermediate Representation (IR)**, a simplified, typed
     assembly-like language.
5. **CodeGen**: Translates IR to WebAssembly.
   - **Responsibilities**: Stack management, block/loop depth calculation,
     memory alignment.
6. **Runtime**: JavaScript layer that provides the "Operating System" for the
   game (Rendering, IO, Audio).
