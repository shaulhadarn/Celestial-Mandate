/* Updated: frameloop set to always (demand broke useFrame/composer render loop causing blank system view); drei Stars, AdaptiveDpr, AdaptiveEvents, PerformanceMonitor active */
import { jsxDEV } from "react/jsx-dev-runtime";
import React, { useEffect, useRef, useState } from "react";
import { Canvas, useThree, useFrame, extend } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Stars, AdaptiveDpr, AdaptiveEvents, Environment, PerformanceMonitor, Preload } from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { groups, setGlobalScene, setGlobalCamera, setGlobalRenderer, setGlobalControls, setGlobalComposer } from "./core/scene_config.js";
import { updateFrame } from "./visuals/renderer.js";
extend({ EffectComposer, RenderPass, UnrealBloomPass });
const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
const SceneBindings = () => {
  const { scene, camera, gl } = useThree();
  useEffect(() => {
    setGlobalScene(scene);
    setGlobalCamera(camera);
    setGlobalRenderer(gl);
    // Enable high-quality rendering settings
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = isMobileDevice ? 0.85 : 1.1;
    if (!isMobileDevice) {
      gl.shadowMap.enabled = true;
      gl.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    scene.background = new THREE.Color(132104);
    scene.fog = new THREE.FogExp2(132104, 15e-4);
    // Start with galaxy hidden — focusHome will call enterSystemView which sets visibility correctly
    groups.galaxy.visible = false;
    groups.system.visible = true;
    groups.planet.visible = false;
    scene.add(groups.galaxy);
    scene.add(groups.system);
    scene.add(groups.planet);
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
  useEffect(() => {
    if (isMobileDevice) {
      composer.current = null;
      setGlobalComposer(null);
      return () => {
        setGlobalComposer(null);
      };
    }

    const comp = new EffectComposer(gl);
    comp.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.8, 0.5, 0.6);
    bloomPass.threshold = 0.6;
    bloomPass.strength = 0.9;
    bloomPass.radius = 0.6;
    comp.addPass(bloomPass);
    composer.current = comp;
    setGlobalComposer(comp);
    return () => {
      comp.dispose();
      setGlobalComposer(null);
    };
  }, [gl, scene, camera, size]);
  useFrame((state, delta) => {
    updateFrame(state, delta);
    if (!isMobileDevice && composer.current) {
      composer.current.render();
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
  return /* @__PURE__ */ jsxDEV(
    Stars,
    {
      radius: 600,
      depth: 120,
      count: isMobileDevice ? 3000 : 8000,
      factor: isMobileDevice ? 3 : 5,
      saturation: 0.4,
      fade: true,
      speed: 0.3
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
const Game = () => {
  return /* @__PURE__ */ jsxDEV(
    Canvas,
    {
      shadows: !isMobileDevice,
      frameloop: "always",
      dpr: isMobileDevice ? [1, 1.25] : [1, 2],
      gl: {
        antialias: !isMobileDevice,
        alpha: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: isMobileDevice ? 0.85 : 1.1,
        outputColorSpace: THREE.SRGBColorSpace
      },
      style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 },
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
