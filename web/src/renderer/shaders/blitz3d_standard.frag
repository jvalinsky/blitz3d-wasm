#version 300 es
precision highp float;
precision highp int;

// Light types matching Blitz3D
#define LIGHT_DIRECTIONAL 1
#define LIGHT_POINT       2
#define LIGHT_SPOT        3
#define MAX_LIGHTS        8

struct Light {
    int type;           // 0=unused, 1=directional, 2=point, 3=spot
    vec3 position;
    vec3 direction;
    vec3 color;
    float range;
    float innerCone;    // cos(inner angle)
    float outerCone;    // cos(outer angle)
};

// Inputs from vertex shader
in vec3 v_worldPos;
in vec3 v_normal;
in vec2 v_uv0;
in vec2 v_uv1;
in vec4 v_color;
in float v_fogFactor;

// Material uniforms (Blitz3D brush properties)
uniform vec4 u_brushColor;       // RGBA from EntityColor/BrushColor + alpha
uniform float u_brushShininess;
uniform int u_entityFX;          // Blitz3D FX flags: 1=fullbright, 2=vertexcolor, 4=flatshade, 8=nofog, 16=nocull, 32=nozbuffer

// Textures
uniform sampler2D u_texture0;    // Diffuse
uniform sampler2D u_texture1;    // Lightmap / secondary
uniform int u_hasTexture0;
uniform int u_hasTexture1;
uniform int u_textureBlend0;     // 0=none, 1=alpha, 2=multiply, 3=add
uniform int u_textureBlend1;

// Lighting
uniform vec3 u_ambientColor;
uniform Light u_lights[MAX_LIGHTS];
uniform int u_lightCount;
uniform vec3 u_cameraPos;

// Fog
uniform highp int u_fog_mode;
uniform vec3 u_fogColor;

// Blending
uniform int u_blendMode;        // 1=normal(alpha), 2=multiply, 3=additive

out vec4 fragColor;

vec3 calcLight(Light light, vec3 normal, vec3 viewDir) {
    vec3 lightDir;
    float attenuation = 1.0;

    if (light.type == LIGHT_DIRECTIONAL) {
        lightDir = normalize(-light.direction);
    } else {
        vec3 toLight = light.position - v_worldPos;
        float dist = length(toLight);
        lightDir = toLight / dist;

        // Range attenuation
        if (light.range > 0.0) {
            attenuation = clamp(1.0 - dist / light.range, 0.0, 1.0);
            attenuation *= attenuation;
        }

        // Spot cone
        if (light.type == LIGHT_SPOT) {
            float theta = dot(lightDir, normalize(-light.direction));
            float epsilon = light.innerCone - light.outerCone;
            float spotFactor = clamp((theta - light.outerCone) / max(epsilon, 0.001), 0.0, 1.0);
            attenuation *= spotFactor;
        }
    }

    // Blinn-Phong
    float NdotL = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = light.color * NdotL;

    vec3 halfDir = normalize(lightDir + viewDir);
    float NdotH = max(dot(normal, halfDir), 0.0);
    float specPower = max(u_brushShininess * 128.0, 1.0);
    float spec = (u_brushShininess > 0.0) ? pow(NdotH, specPower) : 0.0;
    vec3 specular = light.color * spec;

    return (diffuse + specular) * attenuation;
}

void main() {
    vec3 normal = normalize(v_normal);
    vec3 viewDir = normalize(u_cameraPos - v_worldPos);

    // Base color from brush
    vec4 baseColor = u_brushColor;

    // Vertex colors (FX bit 2)
    if ((u_entityFX & 2) != 0) {
        baseColor *= v_color;
    }

    // Texture sampling
    vec4 tex0Color = vec4(1.0);
    if (u_hasTexture0 != 0) {
        tex0Color = texture(u_texture0, v_uv0);
    }

    vec4 tex1Color = vec4(1.0);
    if (u_hasTexture1 != 0) {
        tex1Color = texture(u_texture1, v_uv1);
    }

    // Apply texture 0
    vec4 texColor = tex0Color;

    // Apply texture 1 (lightmap blending)
    if (u_hasTexture1 != 0) {
        if (u_textureBlend1 == 2) {
            // Multiply (lightmap)
            texColor.rgb *= tex1Color.rgb * 2.0;
        } else if (u_textureBlend1 == 3) {
            // Additive
            texColor.rgb += tex1Color.rgb;
        } else {
            // Alpha blend
            texColor.rgb = mix(texColor.rgb, tex1Color.rgb, tex1Color.a);
        }
    }

    baseColor *= texColor;

    // Lighting
    vec3 litColor;
    if ((u_entityFX & 1) != 0) {
        // Fullbright - no lighting
        litColor = baseColor.rgb;
    } else {
        vec3 lighting = u_ambientColor;
        for (int i = 0; i < MAX_LIGHTS; i++) {
            if (i >= u_lightCount) break;
            if (u_lights[i].type == 0) continue;
            lighting += calcLight(u_lights[i], normal, viewDir);
        }
        litColor = baseColor.rgb * lighting;
    }

    // Fog
    if (u_fog_mode != 0 && (u_entityFX & 8) == 0) {
        litColor = mix(u_fogColor, litColor, v_fogFactor);
    }

    fragColor = vec4(litColor, baseColor.a);
}
