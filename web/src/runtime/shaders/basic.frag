#version 300 es
precision mediump float;
// Basic fragment shader for WebGL 2
// Simple white color output

in vec3 v_normal;
in vec2 v_uv;

out vec4 fragColor;

void main() {
    // Simple white color for now
    // TODO: Add lighting, textures
    fragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
