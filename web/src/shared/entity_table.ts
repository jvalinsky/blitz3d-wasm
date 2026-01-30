/**
 * Entity Table ABI
 * Shared memory layout for high-frequency entity state access.
 */

export const ENTITY_ENTRY_FLOATS = 9;
export const ENTITY_ENTRY_BYTES = ENTITY_ENTRY_FLOATS * 4;

// Indices within an entry
export const enum EntityTableIdx {
    X = 0,
    Y = 1,
    Z = 2,
    Pitch = 3,
    Yaw = 4,
    Roll = 5,
    SX = 6,
    SY = 7,
    SZ = 8,
}

export class EntityTableView {
    private dv: DataView;
    private floatView: Float32Array;

    constructor(buffer: ArrayBuffer, byteOffset: number, byteLength: number) {
        this.dv = new DataView(buffer, byteOffset, byteLength);
        this.floatView = new Float32Array(buffer, byteOffset, byteLength / 4);
    }

    getX(id: number): number {
        const off = id * ENTITY_ENTRY_FLOATS;
        return this.floatView[off + EntityTableIdx.X];
    }

    getY(id: number): number {
        const off = id * ENTITY_ENTRY_FLOATS;
        return this.floatView[off + EntityTableIdx.Y];
    }

    getZ(id: number): number {
        const off = id * ENTITY_ENTRY_FLOATS;
        return this.floatView[off + EntityTableIdx.Z];
    }

    getPitch(id: number): number {
        const off = id * ENTITY_ENTRY_FLOATS;
        return this.floatView[off + EntityTableIdx.Pitch];
    }

    getYaw(id: number): number {
        const off = id * ENTITY_ENTRY_FLOATS;
        return this.floatView[off + EntityTableIdx.Yaw];
    }

    getRoll(id: number): number {
        const off = id * ENTITY_ENTRY_FLOATS;
        return this.floatView[off + EntityTableIdx.Roll];
    }

    getScaleX(id: number): number {
        const off = id * ENTITY_ENTRY_FLOATS;
        return this.floatView[off + EntityTableIdx.SX];
    }

    getScaleY(id: number): number {
        const off = id * ENTITY_ENTRY_FLOATS;
        return this.floatView[off + EntityTableIdx.SY];
    }

    getScaleZ(id: number): number {
        const off = id * ENTITY_ENTRY_FLOATS;
        return this.floatView[off + EntityTableIdx.SZ];
    }

    setX(id: number, v: number) {
        const off = id * ENTITY_ENTRY_FLOATS;
        this.floatView[off + EntityTableIdx.X] = v;
    }

    setY(id: number, v: number) {
        const off = id * ENTITY_ENTRY_FLOATS;
        this.floatView[off + EntityTableIdx.Y] = v;
    }

    setZ(id: number, v: number) {
        const off = id * ENTITY_ENTRY_FLOATS;
        this.floatView[off + EntityTableIdx.Z] = v;
    }

    setPitch(id: number, v: number) {
        const off = id * ENTITY_ENTRY_FLOATS;
        this.floatView[off + EntityTableIdx.Pitch] = v;
    }

    setYaw(id: number, v: number) {
        const off = id * ENTITY_ENTRY_FLOATS;
        this.floatView[off + EntityTableIdx.Yaw] = v;
    }

    setRoll(id: number, v: number) {
        const off = id * ENTITY_ENTRY_FLOATS;
        this.floatView[off + EntityTableIdx.Roll] = v;
    }

    setScaleX(id: number, v: number) {
        const off = id * ENTITY_ENTRY_FLOATS;
        this.floatView[off + EntityTableIdx.SX] = v;
    }

    setScaleY(id: number, v: number) {
        const off = id * ENTITY_ENTRY_FLOATS;
        this.floatView[off + EntityTableIdx.SY] = v;
    }

    setScaleZ(id: number, v: number) {
        const off = id * ENTITY_ENTRY_FLOATS;
        this.floatView[off + EntityTableIdx.SZ] = v;
    }
}
