/**
 * Instanced grass blade system for grassy planet types.
 * Adapted from al-ro's three.js grass (instanced + custom shader).
 * Alien-planet color palettes per planet type.
 */
import * as THREE from 'three';
import { isMobile as isMobileDevice } from '../core/device.js';
import { getTerrainHeightFast } from './visuals_planet_terrain.js';

// ── Grass configuration per planet type ─────────────────────────────────────

const GRASS_CONFIGS = {
    Terran: {
        tipColor:    new THREE.Color(0.15, 0.75, 0.2),
        bottomColor: new THREE.Color(0.02, 0.18, 0.02),
        bladeHeight: 1.6,
        bladeWidth:  0.14,
        density:     1.0,
    },
    Continental: {
        tipColor:    new THREE.Color(0.25, 0.85, 0.15),
        bottomColor: new THREE.Color(0.04, 0.22, 0.01),
        bladeHeight: 1.8,
        bladeWidth:  0.16,
        density:     1.0,
    },
    Ocean: {
        tipColor:    new THREE.Color(0.05, 0.55, 0.35),
        bottomColor: new THREE.Color(0.01, 0.12, 0.08),
        bladeHeight: 1.2,
        bladeWidth:  0.12,
        density:     0.5,
    },
};

/** Returns true if the planet type should have grass. */
export function hasGrass(planetType) {
    return !!GRASS_CONFIGS[planetType];
}

// ── Quaternion math helpers ─────────────────────────────────────────────────

function multiplyQuaternions(q1, q2) {
    return new THREE.Vector4(
        q1.x * q2.w + q1.y * q2.z - q1.z * q2.y + q1.w * q2.x,
       -q1.x * q2.z + q1.y * q2.w + q1.z * q2.x + q1.w * q2.y,
        q1.x * q2.y - q1.y * q2.x + q1.z * q2.w + q1.w * q2.z,
       -q1.x * q2.x - q1.y * q2.y - q1.z * q2.z + q1.w * q2.w,
    );
}

function quatFromAxisAngle(ax, ay, az, angle) {
    const ha = angle * 0.5;
    const s = Math.sin(ha);
    return new THREE.Vector4(ax * s, ay * s, az * s, Math.cos(ha)).normalize();
}

// ── Build instanced grass mesh ──────────────────────────────────────────────

/**
 * Creates a grass mesh covering a square area around (0,0).
 * Returns { mesh, material } — material.uniforms.time must be updated per frame.
 */
export function createGrassMesh(planetType) {
    const conf = GRASS_CONFIGS[planetType];
    if (!conf) return null;

    const { bladeHeight: bH, bladeWidth: bW } = conf;
    const joints = 4; // segments along the blade

    // Instance count — scaled by density and reduced on mobile
    const baseCount = isMobileDevice ? 18000 : 55000;
    const instances = Math.round(baseCount * conf.density);
    const width = 200; // scatter area radius*2

    // Base blade geometry (a thin plane subdivided along Y)
    const baseGeom = new THREE.PlaneGeometry(bW, bH, 1, joints);
    baseGeom.translate(0, bH / 2, 0); // pivot at root

    // Per-instance attribute data
    const offsets            = new Float32Array(instances * 3);
    const orientations       = new Float32Array(instances * 4);
    const stretches          = new Float32Array(instances);
    const halfRootAngleSins  = new Float32Array(instances);
    const halfRootAngleCoses = new Float32Array(instances);

    const minTilt = -0.25;
    const maxTilt =  0.25;

    for (let i = 0; i < instances; i++) {
        // Random position within scatter square
        const ox = Math.random() * width - width / 2;
        const oz = Math.random() * width - width / 2;

        // Skip blades that fall inside the flattened center (colony area)
        const dist = Math.sqrt(ox * ox + oz * oz);
        if (dist < 30) {
            // Push blade further out
            const angle = Math.atan2(oz, ox);
            const pushDist = 30 + Math.random() * 5;
            offsets[i * 3]     = Math.cos(angle) * pushDist;
            offsets[i * 3 + 2] = Math.sin(angle) * pushDist;
        } else {
            offsets[i * 3]     = ox;
            offsets[i * 3 + 2] = oz;
        }
        // Y will be set from terrain height
        offsets[i * 3 + 1] = getTerrainHeightFast(offsets[i * 3], offsets[i * 3 + 2]);

        // Random Y rotation
        const yAngle = Math.PI - Math.random() * Math.PI * 2;
        halfRootAngleSins[i] = Math.sin(yAngle * 0.5);
        halfRootAngleCoses[i] = Math.cos(yAngle * 0.5);

        let q = quatFromAxisAngle(0, 1, 0, yAngle);

        // Random tilt around X
        const xAngle = minTilt + Math.random() * (maxTilt - minTilt);
        q = multiplyQuaternions(q, quatFromAxisAngle(1, 0, 0, xAngle));

        // Random tilt around Z
        const zAngle = minTilt + Math.random() * (maxTilt - minTilt);
        q = multiplyQuaternions(q, quatFromAxisAngle(0, 0, 1, zAngle));

        orientations[i * 4]     = q.x;
        orientations[i * 4 + 1] = q.y;
        orientations[i * 4 + 2] = q.z;
        orientations[i * 4 + 3] = q.w;

        // Height variety — 1/3 are taller
        stretches[i] = i < instances / 3 ? Math.random() * 1.8 : Math.random();
    }

    // Build InstancedBufferGeometry
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = baseGeom.index;
    geo.attributes.position = baseGeom.attributes.position;
    geo.attributes.uv = baseGeom.attributes.uv;
    geo.setAttribute('offset',            new THREE.InstancedBufferAttribute(offsets, 3));
    geo.setAttribute('orientation',       new THREE.InstancedBufferAttribute(orientations, 4));
    geo.setAttribute('stretch',           new THREE.InstancedBufferAttribute(stretches, 1));
    geo.setAttribute('halfRootAngleSin',  new THREE.InstancedBufferAttribute(halfRootAngleSins, 1));
    geo.setAttribute('halfRootAngleCos',  new THREE.InstancedBufferAttribute(halfRootAngleCoses, 1));
    geo.instanceCount = instances;

    // Shader material — wind + color gradient
    const material = new THREE.ShaderMaterial({
        uniforms: {
            time:        { value: 0 },
            bladeHeight: { value: bH },
            tipColor:    { value: conf.tipColor },
            bottomColor: { value: conf.bottomColor },
        },
        vertexShader: /* glsl */`
            precision mediump float;
            attribute vec3 offset;
            attribute vec4 orientation;
            attribute float halfRootAngleSin;
            attribute float halfRootAngleCos;
            attribute float stretch;
            uniform float time;
            uniform float bladeHeight;
            varying vec2 vUv;
            varying float frc;

            // Simplex 2D noise (Ashima Arts)
            vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
            vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
            vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
            float snoise(vec2 v){
                const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
                vec2 i=floor(v+dot(v,C.yy));
                vec2 x0=v-i+dot(i,C.xx);
                vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
                vec4 x12=x0.xyxy+C.xxzz;
                x12.xy-=i1;
                i=mod289(i);
                vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
                vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
                m=m*m;m=m*m;
                vec3 x=2.0*fract(p*C.www)-1.0;
                vec3 h=abs(x)-0.5;
                vec3 ox=floor(x+0.5);
                vec3 a0=x-ox;
                m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
                vec3 g;
                g.x=a0.x*x0.x+h.x*x0.y;
                g.yz=a0.yz*x12.xz+h.yz*x12.yw;
                return 130.0*dot(m,g);
            }

            vec3 rotateVectorByQuaternion(vec3 v,vec4 q){
                return 2.0*cross(q.xyz,v*q.w+cross(q.xyz,v))+v;
            }

            vec4 slerp(vec4 v0,vec4 v1,float t){
                normalize(v0);normalize(v1);
                float d=dot(v0,v1);
                if(d<0.0){v1=-v1;d=-d;}
                if(d>0.9995){
                    vec4 r=t*(v1-v0)+v0;
                    normalize(r);
                    return r;
                }
                float theta0=acos(d);
                float theta=theta0*t;
                float sinTheta=sin(theta);
                float sinTheta0=sin(theta0);
                float s0=cos(theta)-d*sinTheta/sinTheta0;
                float s1=sinTheta/sinTheta0;
                return s0*v0+s1*v1;
            }

            void main(){
                frc=position.y/bladeHeight;
                float noise=1.0-(snoise(vec2((time-offset.x/50.0),(time-offset.z/50.0))));
                vec4 direction=vec4(0.0,halfRootAngleSin,0.0,halfRootAngleCos);
                direction=slerp(direction,orientation,frc);
                vec3 vPosition=vec3(position.x,position.y+position.y*stretch,position.z);
                vPosition=rotateVectorByQuaternion(vPosition,direction);
                // Wind
                float halfAngle=noise*0.15;
                vPosition=rotateVectorByQuaternion(vPosition,normalize(vec4(sin(halfAngle),0.0,-sin(halfAngle),cos(halfAngle))));
                vUv=uv;
                gl_Position=projectionMatrix*modelViewMatrix*vec4(offset+vPosition,1.0);
            }
        `,
        fragmentShader: /* glsl */`
            precision mediump float;
            uniform vec3 tipColor;
            uniform vec3 bottomColor;
            varying vec2 vUv;
            varying float frc;

            void main(){
                // Gradient from bottom color at root to tip color at top
                vec3 col=mix(bottomColor,tipColor,frc);
                // Fake ambient occlusion at root
                float ao=smoothstep(0.0,0.3,frc)*0.6+0.4;
                col*=ao;
                // Blade edge alpha — thin at tip
                float alpha=smoothstep(0.0,0.1,vUv.x)*smoothstep(1.0,0.9,vUv.x);
                alpha*=smoothstep(0.0,0.15,frc)*0.85+0.15;
                if(alpha<0.05) discard;
                gl_FragColor=vec4(col,alpha);

                #include <tonemapping_fragment>
            }
        `,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: true,
        alphaTest: 0.05,
    });

    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false; // grass covers wide area, always partially visible
    mesh.renderOrder = 1;       // after terrain

    return { mesh, material };
}

/**
 * Updates grass time uniform (wind animation).
 * Called from the main update loop.
 */
export function updateGrass(grassData, dt) {
    if (!grassData || !grassData.material) return;
    grassData.material.uniforms.time.value += dt * 0.25;
}
