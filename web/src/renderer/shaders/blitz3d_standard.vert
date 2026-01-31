#version 300 es
precision highp float;
precision highp int;

// Vertex attributes
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv0;
layout(location = 3) in vec2 a_uv1;
layout(location = 4) in vec4 a_color;
layout(location = 5) in vec4 a_boneWeights;
layout(location = 6) in uvec4 a_boneIndices;

// Transforms
uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projMatrix;
uniform mat3 u_normalMatrix;

// Skinning
uniform int u_useSkinning;
uniform mat4 u_bones[64];

// Fog
uniform highp int u_fog_mode;       // 0=none, 1=linear, 2=exp, 3=exp2
uniform float u_fogStart;
uniform float u_fogEnd;
uniform float u_fogDensity;

// Outputs
out vec3 v_worldPos;
out vec3 v_normal;
out vec2 v_uv0;
out vec2 v_uv1;
out vec4 v_color;
out float v_fogFactor;

void main() {
    vec4 localPos = vec4(a_position, 1.0);
    vec3 localNormal = a_normal;

    // Skeletal animation
    if (u_useSkinning != 0) {
        mat4 skinMatrix =
            u_bones[a_boneIndices.x] * a_boneWeights.x +
            u_bones[a_boneIndices.y] * a_boneWeights.y +
            u_bones[a_boneIndices.z] * a_boneWeights.z +
            u_bones[a_boneIndices.w] * a_boneWeights.w;
        localPos = skinMatrix * localPos;
        localNormal = mat3(skinMatrix) * localNormal;
    }

    vec4 worldPos = u_modelMatrix * localPos;
    vec4 viewPos = u_viewMatrix * worldPos;
    gl_Position = u_projMatrix * viewPos;

    v_worldPos = worldPos.xyz;
    v_normal = normalize(u_normalMatrix * localNormal);
    v_uv0 = a_uv0;
    v_uv1 = a_uv1;
    v_color = a_color;

    // Fog calculation (view-space depth)
    float fogDist = length(viewPos.xyz);
    if (u_fog_mode == 1) {
        // Linear
        v_fogFactor = clamp((u_fogEnd - fogDist) / (u_fogEnd - u_fogStart), 0.0, 1.0);
    } else if (u_fog_mode == 2) {
        // Exponential
        v_fogFactor = exp(-u_fogDensity * fogDist);
    } else if (u_fog_mode == 3) {
        // Exponential squared
        float f = u_fogDensity * fogDist;
        v_fogFactor = exp(-f * f);
    } else {
        v_fogFactor = 1.0;
    }
}
