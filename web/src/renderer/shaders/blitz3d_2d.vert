#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position;
layout(location = 1) in vec2 a_uv;
layout(location = 2) in vec4 a_color;

uniform vec2 u_resolution;

out vec2 v_uv;
out vec4 v_color;

void main() {
    // Convert pixel coordinates to clip space
    vec2 clipPos = (a_position / u_resolution) * 2.0 - 1.0;
    clipPos.y = -clipPos.y; // Flip Y for screen-space origin at top-left
    gl_Position = vec4(clipPos, 0.0, 1.0);
    v_uv = a_uv;
    v_color = a_color;
}
