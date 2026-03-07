/* Updated: Fixed mobile galaxy touch — OrbitControls touch.ONE set to PAN so single-finger drag moves the galaxy map, passive:false touch events in renderer.js prevent scroll hijack */
import { jsxDEV } from "react/jsx-dev-runtime";
import React, { useEffect, useRef, useState } from "react";
import { Canvas, useThree, useFrame, extend } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Stars, AdaptiveDpr, AdaptiveEvents, Environment, PerformanceMonitor, Preload } from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { groups, setGlobalScene, setGlobalCamera, setGlobalRenderer, setGlobalControls, setGlobalComposer, getGraphicsConfig, applyGraphicsConfig } from "./core/scene_config.js";
import { detectFromRenderer, gpuTier } from "./core/gpu_tier.js";
import { updateFrame, buildGalaxyVisuals } from "./visuals/renderer.js";
import { gameState } from "./core/state.js";
import { isMobile as isMobileDevice } from "./core/device.js";
extend({ EffectComposer, RenderPass, UnrealBloomPass });
const SceneBindings = () => {
  const { scene, camera, gl } = useThree();
  useEffect(() => {
    setGlobalScene(scene);
    setGlobalCamera(camera);
    setGlobalRenderer(gl);
    // Enable high-quality rendering settings
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = isMobileDevice ? 1.0 : 1.1;
    if (!isMobileDevice) {
      gl.shadowMap.enabled = true;
      gl.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    // Note: applyGraphicsConfig() is called from GameLoop after composer is created,
    // so that pixel ratio, bloom, and anisotropy settings are applied in the right order.
    scene.background = new THREE.Color(132104);
    scene.fog = new THREE.FogExp2(132104, 6e-4);
    // Start with galaxy hidden — focusHome will call enterSystemView which sets visibility correctly
    groups.galaxy.visible = false;
    groups.system.visible = true;
    groups.planet.visible = false;
    scene.add(groups.galaxy);
    scene.add(groups.system);
    scene.add(groups.planet);
    
    // Build galaxy visuals now that scene is ready
    if (gameState.systems && gameState.systems.length > 0) {
      buildGalaxyVisuals(gameState.systems, gameState.hyperlanes);
    }
    
    return () => {
      scene.remove(groups.galaxy);
      scene.remove(groups.system);
      scene.remove(groups.planet);
    };
  }, [scene, camera, gl]);
  return null;
};
const GameLoop = () => {
  const { gl, scene, camera, size, invalidate } = useThree();
  const composer = useRef();

  useEffect(() => {
    window.__r3fInvalidate = invalidate;
    return () => { window.__r3fInvalidate = null; };
  }, [invalidate]);

  // Create composer once — depends only on gl/scene/camera (stable after mount)
  useEffect(() => {
    const dpr = gl.getPixelRatio();
    const cw = gl.domElement.clientWidth || window.innerWidth;
    const ch = gl.domElement.clientHeight || window.innerHeight;
    const pw = Math.floor(cw * dpr);
    const ph = Math.floor(ch * dpr);

    // Create render target at full pixel resolution for crisp anti-aliased output
    // Mobile: UnsignedByteType for reliable MSAA support on mobile GPUs
    // Desktop: HalfFloatType for full HDR bloom precision
    const rt = new THREE.WebGLRenderTarget(pw, ph, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: isMobileDevice ? THREE.UnsignedByteType : THREE.HalfFloatType,
      samples: 4,
    });
    const comp = new EffectComposer(gl, rt);
    comp.setPixelRatio(dpr);
    comp.setSize(cw, ch);
    comp.addPass(new RenderPass(scene, camera));

    if (isMobileDevice) {
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(Math.floor(pw / 2), Math.floor(ph / 2)),
        0.75, 0.45, 0.75
      );
      comp.addPass(bloomPass);
    } else {
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(pw, ph),
        0.9, 0.6, 0.6
      );
      comp.addPass(bloomPass);
    }

    composer.current = comp;
    setGlobalComposer(comp);
    applyGraphicsConfig();
    return () => {
      comp.dispose();
      composer.current = null;
      setGlobalComposer(null);
    };
  }, [gl, scene, camera]);

  // Resize composer cheaply when window size changes — no rebuild
  useEffect(() => {
    if (!composer.current) return;
    const dpr = gl.getPixelRatio();
    composer.current.setPixelRatio(dpr);
    composer.current.setSize(size.width, size.height);
    const pw = Math.floor(size.width * dpr);
    const ph = Math.floor(size.height * dpr);
    composer.current.passes.forEach(pass => {
      if (pass.resolution) pass.resolution.set(pw, ph);
    });
  }, [size, gl]);

  useFrame((state, delta) => {
    updateFrame(state, delta);
    if (composer.current) {
      composer.current.render();
    } else {
      gl.render(scene, camera);
    }
  }, 1);
  return null;
};
const ControlsWrapper = () => {
  const controlsRef = useRef();
  useEffect(() => {
    if (controlsRef.current) {
      setGlobalControls(controlsRef.current);
      controlsRef.current.minDistance = 20;
      controlsRef.current.maxDistance = 400;
      controlsRef.current.enableRotate = true;
      controlsRef.current.enableZoom = true;
      controlsRef.current.enablePan = true;
      // ONE finger = PAN (moves the galaxy map around, most intuitive on mobile)
      // TWO fingers = DOLLY_PAN (pinch-to-zoom + two-finger pan)
      controlsRef.current.touches = {
        ONE: THREE.TOUCH.PAN,
        TWO: THREE.TOUCH.DOLLY_PAN
      };
      // screenSpacePanning true = pan moves camera in screen XY plane (feels like dragging a map)
      controlsRef.current.screenSpacePanning = true;
    }
  }, []);
  return /* @__PURE__ */ jsxDEV(
    OrbitControls,
    {
      ref: controlsRef,
      enableDamping: true,
      dampingFactor: 0.05,
      makeDefault: true,
      rotateSpeed: 0.6,
      zoomSpeed: 0.8,
      panSpeed: 0.8
    },
    void 0,
    false,
    {
      fileName: "<stdin>",
      lineNumber: 89,
      columnName: 9
    }
  );
};

const SpaceStars = () => {
  const starsRef = useRef();
  useEffect(() => {
    if (starsRef.current && starsRef.current.material) {
      starsRef.current.material.fog = false;
      starsRef.current.material.depthWrite = false;
    }
  }, []);
  // Follow camera so stars act as infinite skybox — no visible dome edge when panning
  useFrame(({ camera }) => {
    if (starsRef.current) {
      starsRef.current.position.copy(camera.position);
    }
  });
  return /* @__PURE__ */ jsxDEV(
    Stars,
    {
      ref: starsRef,
      radius: 900,
      depth: 80,
      count: isMobileDevice ? 3000 : 8000,
      factor: isMobileDevice ? 2.5 : 4,
      saturation: 0.3,
      fade: false,
      speed: 0
    },
    void 0, false, { fileName: "<stdin>", lineNumber: 0, columnNumber: 0 }
  );
};

const QualityManager = () => {
  const [dpr, setDpr] = useState(isMobileDevice ? 1 : 1.5);
  if (isMobileDevice) return null;
  return /* @__PURE__ */ jsxDEV(
    PerformanceMonitor,
    {
      onIncline: () => setDpr(Math.min(2, dpr + 0.25)),
      onDecline: () => setDpr(Math.max(0.75, dpr - 0.25)),
      children: /* @__PURE__ */ jsxDEV(
        AdaptiveDpr,
        { pixelated: true },
        void 0, false, { fileName: "<stdin>", lineNumber: 0, columnNumber: 0 }
      )
    },
    void 0, false, { fileName: "<stdin>", lineNumber: 0, columnNumber: 0 }
  );
};
const GPUDetector = () => {
  const { gl } = useThree();
  useEffect(() => {
    if (!gpuTier.detected) {
      detectFromRenderer(gl, isMobileDevice);
    }
  }, [gl]);
  return null;
};

const Game = () => {
  return /* @__PURE__ */ jsxDEV(
    Canvas,
    {
      shadows: !isMobileDevice,
      frameloop: "always",
      dpr: isMobileDevice ? [1, 2.5] : [1, 4],
      gl: {
        antialias: getGraphicsConfig().antialias,
        alpha: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: isMobileDevice ? 1.0 : 1.1,
        outputColorSpace: THREE.SRGBColorSpace
      },
      style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0, touchAction: "none" },
      children: [
        /* @__PURE__ */ jsxDEV(PerspectiveCamera, { makeDefault: true, position: [0, 100, 100], fov: 60, near: 0.1, far: 1500 }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 111,
          columnNumber: 13
        }),
        /* @__PURE__ */ jsxDEV(ControlsWrapper, {}, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 112,
          columnNumber: 13
        }),
        /* @__PURE__ */ jsxDEV("ambientLight", { intensity: isMobileDevice ? 1.5 : 0.8, color: 0x404060 }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 114,
          columnNumber: 13
        }),
        /* @__PURE__ */ jsxDEV("hemisphereLight", { args: [0x0a0a2a, 0x000010, isMobileDevice ? 0 : 0.6] }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 115,
          columnNumber: 13
        }),
        /* @__PURE__ */ jsxDEV(SceneBindings, {}, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 116,
          columnNumber: 13
        }),
        /* @__PURE__ */ jsxDEV(GameLoop, {}, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 117,
          columnNumber: 13
        }),
        /* @__PURE__ */ jsxDEV(SpaceStars, {}, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 118,
          columnNumber: 13
        }),
        /* @__PURE__ */ jsxDEV(AdaptiveEvents, {}, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 119,
          columnNumber: 13
        }),
        /* @__PURE__ */ jsxDEV(Preload, { all: true }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 120,
          columnNumber: 13
        }),
        /* @__PURE__ */ jsxDEV(QualityManager, {}, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 121,
          columnNumber: 13
        }),
        /* @__PURE__ */ jsxDEV(GPUDetector, {}, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 122,
          columnNumber: 13
        })
      ]
    },
    void 0,
    true,
    {
      fileName: "<stdin>",
      lineNumber: 100,
      columnNumber: 9
    }
  );
};
export {
  Game
};
