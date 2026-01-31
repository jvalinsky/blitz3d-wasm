#version 300 es
precision highp float;

in vec2 v_uv;
in vec4 v_color;

uniform sampler2D u_texture;
uniform int u_hasTexture;

out vec4 fragColor;

void main() {
    vec4 color = v_color;
    if (u_hasTexture != 0) {
        color *= texture(u_texture, v_uv);
    }
    fragColor = color;
}
