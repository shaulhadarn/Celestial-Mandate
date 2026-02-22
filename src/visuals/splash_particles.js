/* Updated: Organized app hierarchy, moved to src/visuals folder, fixed imports and paths */
import * as THREE from 'three';

export const trailParticles = [];

export function spawnTrailParticle(scene, position, trailTexture) {
    const isMobile = window.innerWidth <= 768;
    if (isMobile && trailParticles.length > 80) return;

    const mat = new THREE.SpriteMaterial({
        map: trailTexture,
        color: 0x00ccff,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    
    const baseScale = (isMobile ? 0.6 : 0.8) + Math.random() * 0.4;
    sprite.scale.setScalar(baseScale);
    
    scene.add(sprite);
    
    trailParticles.push({
        sprite: sprite,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        baseScale: baseScale
    });
}

export function updateTrailParticles(scene, dt) {
    for (let i = trailParticles.length - 1; i >= 0; i--) {
        const p = trailParticles[i];
        p.life -= dt;
        
        p.sprite.position.x -= 0.5 * dt;
        
        const lifeRatio = p.life / p.maxLife;
        p.sprite.material.opacity = lifeRatio * 0.6;
        p.sprite.scale.setScalar(p.baseScale * (0.5 + lifeRatio * 0.5));
        
        if (p.life <= 0) {
            scene.remove(p.sprite);
            p.sprite.material.dispose();
            trailParticles.splice(i, 1);
        }
    }
}