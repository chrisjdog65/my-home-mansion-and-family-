// ───────────────────────────────────────────────────────────────────────────
// Interaction: picks whatever you are looking at within reach and turns E
// into the right verb — open, sit, pick up, switch on, talk, drive.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';

const _toTarget = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _ray = new THREE.Ray();

export class Interaction {
  constructor(world, camera, player, props) {
    this.world = world;
    this.camera = camera;
    this.player = player;
    this.props = props;
    this.current = null;
    this.family = [];
    this._famTargets = new Map();
  }

  /** True when a wall (not the target itself) sits between eye and point. */
  blocked(pos, dist) {
    _ray.origin.copy(this.camera.position);
    _ray.direction.copy(pos).sub(this.camera.position).normalize();
    const hit = this.world.octree.rayIntersect(_ray);
    return !!hit && hit.distance < dist - 0.3;
  }

  /** Best interactable in front of the camera. */
  pick() {
    const cam = this.camera;
    cam.getWorldDirection(_fwd);
    let best = null, bestScore = Infinity, bestDist = 0;

    const consider = (target, pos, radius) => {
      _toTarget.copy(pos).sub(cam.position);
      const dist = _toTarget.length();
      if (dist > radius) return;
      _toTarget.multiplyScalar(1 / Math.max(dist, 1e-5));
      const dot = _toTarget.dot(_fwd);
      if (dot < 0.55) return;                       // roughly a 56° cone
      const score = dist * (2 - dot);
      if (score < bestScore) { bestScore = score; best = target; bestDist = dist; this._bestPos = pos; }
    };

    for (const i of this.world.interactables) {
      if (i.disabled) continue;
      if (i.kind === 'prop' && this.props.held === i.data) continue;
      consider(i, i.pos, i.radius);
    }
    for (const f of this.family) {
      let t = this._famTargets.get(f);
      if (!t) {
        t = { kind: 'family', data: f, label: () => `Talk to ${f.name}`, eye: new THREE.Vector3() };
        this._famTargets.set(f, t);
      }
      consider(t, f.char.eyePos(t.eye), 3.0);
    }
    // no using the fireplace through the living-room wall
    if (best && this.blocked(this._bestPos, bestDist)) best = null;
    this.current = best;
    return best;
  }

  labelFor(i) {
    if (!i) return null;
    return typeof i.label === 'function' ? i.label() : i.label;
  }

  use(i, game) {
    if (!i) return null;
    switch (i.kind) {
      case 'seat':
        this.player.sit(i.seat);
        return 'click';
      case 'prop': {
        this.props.grab(i.data);
        game.ui.setHeld(i.data.name);
        return 'pickup';
      }
      case 'vehicle': {
        this.player.drive(i.data);
        game.audio.startEngine();
        return 'engine';
      }
      case 'family':
        game.startDialogue(i.data);
        return null;
      case 'piano':
        game.playPiano();
        return null;
      default:
        return i.onUse ? i.onUse() : 'click';
    }
  }
}
