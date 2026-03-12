/**
 * Shared mutable state for the planet exploration system.
 * All sub-modules import this single object instead of passing dozens of variables.
 */
import * as THREE from 'three';

const planetState = {
    // Scene references (set during createPlanetVisuals, read during update)
    playerMesh: null,
    terrainMesh: null,
    planetProps: [],
    colonyBuildingsGroup: null,
    currentPlanetData: null,
    explorationGroup: null,
    sunLight: null,
    dustMesh: null,
    creatures: [],
    cloudLayers: [],

    // Camera orbit parameters (written by input handlers, read by update loop)
    cameraYaw: Math.PI,
    cameraPitch: 0.4,
    cameraDistance: 18,

    // Input state (written by keyboard/joystick handlers, read by update loop)
    keyState: {},
    joystickInput: { x: 0, y: 0 },

    // Mouse/touch tracking (written and read by input handlers)
    isMouseDown: false,
    lastMouseX: 0,
    lastMouseY: 0,
    pinchStartDist: 0,
    isPinching: false,
    cameraDragTouchId: null,

    // HUD/placement state (written by HUD buttons, read by update loop)
    placementMode: null,
    nearestHarvesterData: null,

    // Control target (null = drone, soldier mesh = controlling that soldier)
    controlTarget: null,
    buildingInfoTarget: null,

    // Camera transition targets (smoothly lerped in update loop)
    targetCameraDistance: 18,
    cameraHeightOffset: 2,     // dynamic, lerped toward target
    targetCameraHeightOffset: 2,
};

// Constants
export const CAMERA_DISTANCE_MIN = 5;
export const CAMERA_DISTANCE_MAX = 60;
export const CAMERA_HEIGHT_OFFSET = 2;
export const JOYSTICK_ZONE_WIDTH_RATIO = 0.42;

export default planetState;
