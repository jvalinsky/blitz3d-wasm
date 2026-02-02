import { Blitz3DGraphicsInterface } from "../types.ts";
import { GLCommandExecutor } from "../../gl_command_executor.ts";

import { setupCore } from "./core.ts";
import { setup2D } from "./2d.ts";
import { setupImage } from "./image.ts";
import { setup3D } from "./3d.ts";
import { setupPicking } from "./picking.ts";
import { setupCollision } from "./collision.ts";
import { setupInput } from "./input.ts";
import { setupWasmAudio } from "./wasm_audio.ts";
import { setupTransform } from "./transform.ts";
import { setupMaterial } from "./material.ts";
import { setupMesh } from "./mesh.ts";
import { setupNative3D } from "./native3d.ts";
import { ShadowMapManager, NativeWebGLRenderer } from "../../native_renderer.ts";
import { setupShadowMaps } from "./shadows.ts";
import { setupNativeMesh } from "./native_mesh.ts";
import { setupNativeTexture } from "./native_texture.ts";

export function setupAllImports(graphics: Blitz3DGraphicsInterface, imports: any) {
    setupCore(graphics, imports);
    setup2D(graphics, imports);
    setupImage(graphics, imports);
    setup3D(graphics, imports);
    setupTransform(graphics, imports);
    setupMaterial(graphics, imports);
    setupMesh(graphics, imports);
    setupInput(graphics, imports);
    setupCollision(graphics, imports);
    setupPicking(graphics, imports);
    setupWasmAudio(graphics, imports);

    const executor = graphics.core?.glexecutor as GLCommandExecutor | null | undefined;
    const gl = graphics.core?.gl as WebGL2RenderingContext | null | undefined;
    if (executor && gl) {
        // Native 3D entities
        const nativeEntities = new Map<number, any>();
        const nextEntityId = { value: 1 };
        setupNative3D(executor, nativeEntities, nextEntityId);

        // Native meshes and textures
        const nativeMeshes = new Map<number, any>();
        const nativeTextures = new Map<number, any>();
        const nativeImages = new Map<number, HTMLImageElement>();
        const nextMeshId = { value: 1 };
        const nextTextureId = { value: 1 };
        const vaoHandles = new Map<number, number>();

        // Get fileSystem from core
        const fileSystem = graphics.core?.fileSystem as Map<string, any> | undefined;
        const readString = graphics.core?.readString;

        setupNativeMesh(executor, gl, nativeMeshes, nativeTextures, nextMeshId, vaoHandles);
        setupNativeTexture(executor, gl, nativeTextures, nativeImages, nextTextureId, fileSystem, readString);

        // Shadow maps
        const nativeLights = new Map<number, { position: [number, number, number]; range: number; castShadows: boolean }>();
        const shadowManager = new ShadowMapManager(executor, gl);
        setupShadowMaps(shadowManager, nativeLights);

        if (graphics.core) {
            (graphics.core as any).nativeEntities = nativeEntities;
            (graphics.core as any).nativeNextEntityId = nextEntityId;
            (graphics.core as any).nativeMeshes = nativeMeshes;
            (graphics.core as any).nativeTextures = nativeTextures;
            (graphics.core as any).nativeNextMeshId = nextMeshId;
            (graphics.core as any).nativeLights = nativeLights;
            (graphics.core as any).shadowManager = shadowManager;
        }
    }
}
