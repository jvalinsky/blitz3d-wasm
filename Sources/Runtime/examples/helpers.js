/**
 * Three.js Helpers for SCPCB Asset Viewer
 * ES6-compatible versions for Three.js r150+
 */

(function () {
  "use strict";

  class VertexNormalsHelper extends THREE.LineSegments {
    constructor(object, size = 1, color = 0xff0000) {
      const geometry = new THREE.BufferGeometry();
      const positions = [];
      const normals = [];

      const posAttr = object.geometry.attributes.position;
      const normAttr = object.geometry.attributes.normal;

      for (let i = 0; i < posAttr.count; i++) {
        positions.push(
          posAttr.getX(i),
          posAttr.getY(i),
          posAttr.getZ(i),
        );
        normals.push(
          normAttr.getX(i),
          normAttr.getY(i),
          normAttr.getZ(i),
        );
      }

      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geometry.setAttribute(
        "normal",
        new THREE.Float32BufferAttribute(normals, 3),
      );

      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        toneMapped: false,
      });

      super(geometry, material);
      this.object = object;
      this.size = size;
      this.color = color;

      this.update();
    }

    update() {
      const objNorm = this.object.geometry.attributes.normal;
      const positions = this.geometry.attributes.position.array;
      const colors = [];

      const color = new THREE.Color(this.color);

      for (let i = 0; i < objNorm.count; i++) {
        const x = objNorm.getX(i) * this.size;
        const y = objNorm.getY(i) * this.size;
        const z = objNorm.getZ(i) * this.size;

        const idx = i * 6;
        colors.push(color.r, color.g, color.b);
        colors.push(color.r, color.g, color.b);
      }

      this.geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(colors, 3),
      );
    }

    dispose() {
      this.geometry.dispose();
      this.material.dispose();
    }
  }

  class BoxHelper extends THREE.LineSegments {
    constructor(object, color = 0xffff00) {
      const box = new THREE.Box3().setFromObject(object);
      const geometry = new THREE.EdgesGeometry(
        new THREE.BoxGeometry(
          box.max.x - box.min.x,
          box.max.y - box.min.y,
          box.max.z - box.min.z,
        ),
      );
      const material = new THREE.LineBasicMaterial({ color });

      super(geometry, material);
      this.object = object;
    }

    update() {
      const box = new THREE.Box3().setFromObject(this.object);
      const size = new THREE.Vector3(
        box.max.x - box.min.x,
        box.max.y - box.min.y,
        box.max.z - box.min.z,
      );
      const center = new THREE.Vector3(
        box.min.x + size.x / 2,
        box.min.y + size.y / 2,
        box.min.z + size.z / 2,
      );

      this.geometry.dispose();
      this.geometry = new THREE.EdgesGeometry(
        new THREE.BoxGeometry(size.x, size.y, size.z),
      );
      this.position.copy(center);
    }

    dispose() {
      this.geometry.dispose();
      this.material.dispose();
    }
  }

  class AxesHelper extends THREE.LineSegments {
    constructor(size = 1) {
      const vertices = [
        0,
        0,
        0,
        size,
        0,
        0,
        0,
        0,
        0,
        0,
        size,
        0,
        0,
        0,
        0,
        0,
        0,
        size,
      ];
      const colors = [
        1,
        0,
        0,
        1,
        0.5,
        0,
        0,
        1,
        0,
        0.5,
        1,
        0,
        0,
        0,
        1,
        0,
        0.5,
        1,
      ];

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3),
      );
      geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(colors, 3),
      );

      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        toneMapped: false,
      });

      super(geometry, material);
    }
  }

  // Export helpers to global scope
  window.VertexNormalsHelper = VertexNormalsHelper;
  window.BoxHelper = BoxHelper;
  window.AxesHelper = AxesHelper;

  THREE.VertexNormalsHelper = VertexNormalsHelper;
  THREE.BoxHelper = BoxHelper;
  THREE.AxesHelper = AxesHelper;
})();
