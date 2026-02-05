import { Blitz3DGraphicsInterface } from "../types.ts";

import { setupCore } from "./core.ts";
import { setup2D } from "./2d.ts";
import { setupImage } from "./image.ts";
import { setup3D } from "./3d.ts";
import { setupPicking } from "./picking.ts";
import { setupCollision } from "./collision.ts";
import { setupInput } from "./input.ts";
import { setupWasmAudio } from "./wasm_audio.ts";
import { setupAnimation } from "./animation.ts";
import { setupSCPCB } from "./scpcb.ts";

export function setupAllImports(graphics: Blitz3DGraphicsInterface, imports: any) {
    setupCore(graphics, imports);
    setup2D(graphics, imports);
    setupImage(graphics, imports);
    setup3D(graphics, imports);
    setupAnimation(graphics, imports);
    setupInput(graphics, imports);
    setupCollision(graphics, imports);
    setupPicking(graphics, imports);
    setupWasmAudio(graphics, imports);
    setupSCPCB(graphics, imports);
}
