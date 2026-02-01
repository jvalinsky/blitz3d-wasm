#version 300 es
precision mediump float;
// GLSL fragment shader - simple white

in vec3 v_normal;
in vec2 v_uv;

out vec4 fragColor;

void main() {
    // Simple white color
    fragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
