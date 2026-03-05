/* Updated: Organized app hierarchy, moved to ./src folder, fixed imports and paths */
import { jsxDEV } from "react/jsx-dev-runtime";
import React, { useEffect, useRef, useState } from "react";
import { Canvas, useThree, useFrame, extend } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { isMobile } from "./core/device.js";
import { groups, setGlobalScene, setGlobalCamera, setGlobalRenderer, setGlobalControls, setGlobalComposer } from "./core/scene_config.js";
import { updateFrame } from "./visuals/renderer.js";
extend({ EffectComposer, RenderPass, UnrealBloomPass, OutputPass });
const SceneBindings = () => {
  const { scene, camera, gl } = useThree();
  useEffect(() => {
    setGlobalScene(scene);
    setGlobalCamera(camera);
    setGlobalRenderer(gl);
    scene.background = new THREE.Color(132104);
    scene.fog = new THREE.FogExp2(132104, 15e-4);
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
  const { gl, scene, camera, size } = useThree();
  const composer = useRef();
  useEffect(() => {
    const rtWidth = isMobile ? Math.floor(size.width / 2) : size.width;
    const rtHeight = isMobile ? Math.floor(size.height / 2) : size.height;
    const rtParams = {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: isMobile ? THREE.UnsignedByteType : THREE.HalfFloatType
    };
    const renderTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight, rtParams);
    const comp = new EffectComposer(gl, renderTarget);
    comp.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(rtWidth, rtHeight),
        isMobile ? 0.5 : 0.8,   // strength
        isMobile ? 0.3 : 0.5,   // radius
        isMobile ? 0.8 : 0.6    // threshold (higher = less bloom = faster)
    );
    bloomPass.threshold = isMobile ? 0.8 : 0.6;
    bloomPass.strength = isMobile ? 0.5 : 0.9;
    bloomPass.radius = isMobile ? 0.3 : 0.6;
    comp.addPass(bloomPass);
    comp.addPass(new OutputPass());
    composer.current = comp;
    setGlobalComposer(comp);
    return () => {
      comp.dispose();
    };
  }, [gl, scene, camera, size]);
  useFrame((state, delta) => {
    updateFrame(state, delta);
    if (composer.current) {
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
      makeDefault: true
    },
    void 0,
    false,
    {
      fileName: "<stdin>",
      lineNumber: 89,
      columnNumber: 9
    }
  );
};
const Game = () => {
  return /* @__PURE__ */ jsxDEV(
    Canvas,
    {
      shadows: true,
      dpr: [1, 2],
      gl: {
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ReinhardToneMapping
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
        /* @__PURE__ */ jsxDEV("ambientLight", { intensity: 1, color: 4210752 }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 114,
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
