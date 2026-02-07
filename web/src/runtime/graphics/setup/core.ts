import { Blitz3DGraphicsInterface } from "../types.ts";
import * as THREE from "three";

export function setupCore(graphics: Blitz3DGraphicsInterface, imports: any) {
    imports.env.Graphics3D = (width: number, height: number, depth: number, mode: number) => {
        console.log(
            "Graphics3D called: " + width + "x" + height + ", depth=" + depth +
            ", mode=" + mode,
        );

        // Lazy-init renderer/scene/camera the first time Graphics3D is called.
        try {
            const anyG = graphics as any;
            if (!graphics.renderer || !graphics.scene || !graphics.camera) {
                if (typeof anyG.init3D === "function") anyG.init3D();
            }
        } catch (e) {
            console.error("Graphics3D: init3D failed", e);
        }

        // Validate dimensions
        if (width <= 0 || height <= 0) {
            console.error(
                "Graphics3D: Invalid dimensions " + width + "x" + height +
                ", using defaults",
            );
            width = 800;
            height = 600;
        }

        if (width > 4096 || height > 4096) {
            console.warn("Graphics3D: dimensions exceed maximum, capping to 4096");
            width = Math.min(width, 4096);
            height = Math.min(height, 4096);
        }

        if (graphics.core.canvas) {
            console.log(
                "Updating canvas from " + graphics.core.canvas.width + "x" +
                graphics.core.canvas.height + " to " + width + "x" + height,
            );
            graphics.core.canvas.width = width;
            graphics.core.canvas.height = height;
        } else {
            console.error("Graphics3D: canvas is not available!");
        }

        if (graphics.renderer) {
            console.log("Setting renderer size to " + width + "x" + height);
            graphics.renderer.setSize(width, height);

            // Important: Update camera aspect ratio
            if (graphics.camera) {
                if (graphics.camera instanceof (window as any).THREE.PerspectiveCamera) {
                    const cam = graphics.camera as THREE.PerspectiveCamera;
                    console.log(
                        "Updating camera aspect from " + cam.aspect + " to " +
                        (width / height),
                    );
                    cam.aspect = width / height;
                    cam.updateProjectionMatrix();
                    console.log("Camera projection updated");
                }
            }
        } else {
            console.error("Graphics3D: renderer is not initialized!");
        }

        console.log("Graphics3D initialization complete");
    };

    imports.env.GraphicsWidth = () =>
        graphics.core.canvas ? graphics.core.canvas.width : 800;
    imports.env.GraphicsHeight = () =>
        graphics.core.canvas ? graphics.core.canvas.height : 600;
    imports.env.WindowWidth = () => window.innerWidth;
    imports.env.WindowHeight = () => window.innerHeight;
    imports.env.VWait = (n: number) => {
        // VWait is a no-op in the web runtime as we can't block the main thread.
        // In a worker, we could Atomics.wait, but for now we just acknowledge it.
        if (n > 1) {
            // console.warn(`VWait(${n}) ignored (non-blocking runtime)`);
        }
    };
    imports.env.Flip = (sync: number) => {
        // Perform the actual render
        if (graphics.renderer && graphics.scene && graphics.camera) {
            graphics.renderer.render(graphics.scene, graphics.camera);
        }

        // Sampling log to verify it's running but not spam
        if (Math.random() < 0.005) console.log("Flip called (sampled)");
    };

    // Math Utils
    if (!imports.blitz3d) imports.blitz3d = {};
    imports.blitz3d.AbsInt = (n: number) => Math.abs(n | 0);
    imports.blitz3d.MinInt = (a: number, b: number) => Math.min(a | 0, b | 0);
    imports.blitz3d.MaxInt = (a: number, b: number) => Math.max(a | 0, b | 0);

    // Asset Stubs (not implemented yet)
    imports.env.LoadAsset = (pathPtr: number) => {
        console.warn("LoadAsset stub called");
        return 0;
    };
    imports.env.GetAssetData = (asset: number) => 0;
    imports.env.GetAssetSize = (asset: number) => 0;
}
