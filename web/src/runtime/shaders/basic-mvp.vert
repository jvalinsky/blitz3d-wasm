#version 300 es
// GLSL vertex shader with MVP transform

uniform mat4 u_mvp;

in vec3 position;
in vec3 normal;
in vec2 uv;

out vec3 v_normal;
out vec2 v_uv;

void main() {
    gl_Position = u_mvp * vec4(position, 1.0);
    v_normal = normal;
    v_uv = uv;
}
