import * as THREE from 'three';

/**
 * Renders surveillance feeds from the real 3D rooms.
 *
 * Every feed is a render of the room's scene through its fixed camera. The
 * entity models in those scenes are placed by EntityPresenter from the
 * simulation, so what a camera shows is always the simulation state.
 *
 *  feedRT    raw linear render of the selected room (4:3)
 *  monitorRT CCTV-shaded copy shown on the desk monitor in the 3D station
 */
export class CameraFeedRenderer {
  constructor(renderer, postfx) {
    this.renderer = renderer;
    this.postfx = postfx;
    this.feedRT = new THREE.WebGLRenderTarget(512, 384, { type: THREE.HalfFloatType });
    this.monitorRT = new THREE.WebGLRenderTarget(384, 288);
    this.monitorRT.texture.colorSpace = THREE.SRGBColorSpace;
    this.lastFeedRender = -1;
    this.lastMonitorRender = -1;
    this.quality = 1;
  }

  setQuality(scale) {
    const s = Math.max(0.5, Math.min(1, scale));
    if (s === this.quality) return;
    this.quality = s;
    this.feedRT.setSize(Math.round(512 * s), Math.round(384 * s));
  }

  /** Renders the room into feedRT. Returns false if the room has no camera. */
  renderRoom(room) {
    if (!room?.camera) return false;
    const r = this.renderer;
    room.camera.aspect = 4 / 3;
    room.camera.updateProjectionMatrix();
    const prevShadow = r.shadowMap.autoUpdate;
    r.shadowMap.autoUpdate = false; // feeds never need fresh shadow maps
    r.setRenderTarget(this.feedRT);
    r.render(room.scene, room.camera);
    r.setRenderTarget(null);
    r.shadowMap.autoUpdate = prevShadow;
    return true;
  }

  /** CCTV shading into the desk monitor texture. */
  renderMonitor(params) {
    this.postfx.renderFeed(this.feedRT.texture, this.monitorRT, { ...params, aspect: 1 });
  }

  /** CCTV shading full-screen (workstation view), letterboxed to 4:3. */
  renderToScreen(params, screenAspect) {
    this.postfx.renderFeed(this.feedRT.texture, null, { ...params, aspect: screenAspect / (4 / 3) });
  }

  dispose() {
    this.feedRT.dispose();
    this.monitorRT.dispose();
  }
}
