/**
 * GPU tier detection module.
 * Classifies the device GPU into tiers 0-3 for adaptive quality settings.
 * Populated at startup by GPUDetector component in Game.js.
 *
 * Tier 0: Low-end mobile / very old desktop
 * Tier 1: Budget mobile / low-end desktop
 * Tier 2: Mid-range desktop / high-end mobile
 * Tier 3: High-end desktop
 */

export const gpuTier = {
    tier: -1,       // -1 = not yet detected
    isMobile: false,
    gpu: 'unknown',
    detected: false
};

export function setGpuTier(result) {
    gpuTier.tier = result.tier;
    gpuTier.isMobile = result.isMobile;
    gpuTier.gpu = result.gpu || 'unknown';
    gpuTier.detected = true;
}

/**
 * Classify GPU tier from WebGL renderer capabilities.
 * Uses maxTextureSize + precision as proxies for GPU class.
 */
export function detectFromRenderer(gl, isMobile) {
    const ctx = gl.getContext();
    const debugInfo = ctx.getExtension('WEBGL_debug_renderer_info');
    const gpuName = debugInfo ? ctx.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown';
    const maxTex = gl.capabilities.maxTextureSize;
    const maxVaryings = gl.capabilities.maxVaryings;

    let tier;
    if (isMobile) {
        tier = maxTex >= 8192 ? 2 : maxTex >= 4096 ? 1 : 0;
    } else {
        if (maxTex >= 16384 && maxVaryings >= 30) tier = 3;
        else if (maxTex >= 8192) tier = 2;
        else tier = 1;
    }

    setGpuTier({ tier, isMobile, gpu: gpuName });
    return gpuTier;
}
