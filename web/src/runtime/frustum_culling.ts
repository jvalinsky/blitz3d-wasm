export class FrustumCullingManager {
  resetVisibility(entities: Record<number, any>) {
    for (const key in entities) {
      if (entities[key] && typeof entities[key].visible !== "undefined") {
        entities[key].visible = true;
      }
    }
  }

  updateVisibility(entities: Record<number, any>, camera: any, enableCulling: boolean) {
    if (!enableCulling) return;
  }
}
