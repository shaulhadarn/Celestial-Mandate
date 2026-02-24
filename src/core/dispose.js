/**
 * Recursively disposes all GPU resources (geometries, materials, textures)
 * in a Three.js group, then removes all children.
 * Call this instead of bare `while(group.children.length) group.remove(...)`.
 */
export function disposeGroup(group) {
    while (group.children.length > 0) {
        const child = group.children[0];
        if (child.children && child.children.length > 0) {
            disposeGroup(child);
        }
        if (child.geometry) {
            child.geometry.dispose();
        }
        if (child.material) {
            disposeMaterial(child.material);
        }
        group.remove(child);
    }
}

function disposeMaterial(material) {
    if (Array.isArray(material)) {
        material.forEach(m => disposeMaterial(m));
        return;
    }
    if (material.map) material.map.dispose();
    if (material.normalMap) material.normalMap.dispose();
    if (material.roughnessMap) material.roughnessMap.dispose();
    if (material.metalnessMap) material.metalnessMap.dispose();
    if (material.emissiveMap) material.emissiveMap.dispose();
    material.dispose();
}
