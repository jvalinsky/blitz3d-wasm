#version 300 es
// Basic vertex shader for WebGL 2
// Transforms position, passes through normal and UV

in vec3 position;
in vec3 normal;
in vec2 uv;

out vec3 v_normal;
out vec2 v_uv;

void main() {
    gl_Position = vec4(position, 1.0);
    v_normal = normal;
    v_uv = uv;
}
