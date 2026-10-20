function m0(THREE, racingLine, travelled) {
  const duration = 8.4, length = racingLine.getLength();
  const ease = (a, b, t) => {
    const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
    return x * x * x * (x * (x * 6 - 15) + 10);
  };
  const pass = travelled(0.38 / duration);
  const passForward = racingLine.getTangentAt(pass);
  const passRight = new THREE.Vector3(passForward.z, 0, -passForward.x);
  const anchor = racingLine.getPointAt(pass).addScaledVector(passForward, 5.2).addScaledVector(passRight, 3.5);
  anchor.y = 0.73;
  return function poseAt(normalized) {
    const previous = window.__F1CinematicPreviousCamera;
    if (previous) return {
      position: new THREE.Vector3(...previous.position),
      target: new THREE.Vector3(...previous.target),
      up: new THREE.Vector3(0, 1, 0), fov: previous.fov,
      roll: previous.roll||0, principal: previous.principal||[800,450]
    };
    const t = Math.max(0, Math.min(1, normalized)) * duration;
    const u = travelled(t / duration);
    const car = racingLine.getPointAt(u);
    const forward = racingLine.getTangentAt(u);
    const frontRight = new THREE.Vector3(forward.z, 0, -forward.x);
    const page = window.__F1TransitionPose;
    if (page?.active) {
      const push = page.push || 0;
      const position = car.clone().addScaledVector(forward, 5.45 - 0.55 * push)
        .addScaledVector(frontRight, 0.24 * (1 - push));
      position.y = 1.25 - 0.11 * push;
      const target = car.clone().addScaledVector(forward, 0.85 + 0.35 * push);
      target.y = 0.04;
      return {position, target, up: new THREE.Vector3(0, 1, 0), fov: 33 - 2.5 * push};
    }
    const trailing = racingLine.getTangentAt(Math.max(0, u - 5.5 / length));
    const right = new THREE.Vector3(trailing.z, 0, -trailing.x);
    const gap = -12.5 + 0.65 * ease(2.65, 3.65, t) - 0.8 * ease(4.05, 5.35, t);
    const follow = car.clone().addScaledVector(trailing, gap).addScaledVector(right, 6.1);
    follow.y = 1.03;
    const pickup = ease(1.35, 2.85, t);
    let fov = 45 + (22 - 45) * pickup;
    let position = anchor.clone();
    if (pickup > 0) {
      const a = anchor.clone().sub(car).setY(0), b = follow.clone().sub(car).setY(0);
      const anchorExtent = a.length() * Math.tan(45 * Math.PI / 360);
      const followExtent = b.length() * Math.tan(22 * Math.PI / 360);
      const extent = Math.exp(Math.log(anchorExtent) * (1 - pickup) + Math.log(followExtent) * pickup);
      position = car.clone().addScaledVector(a.normalize().lerp(b.normalize(), pickup).normalize(), extent / Math.tan(fov * Math.PI / 360));
      position.y = 0.73 + 0.3 * pickup;
    }
    // One uninterrupted orbit after pickup. Lock the requested left-front view.
    const settle = ease(2.85, 5.15, t);
    if (settle > 0) {
      const followOffset = follow.clone().sub(car).setY(0);
      const startAngle = Math.atan2(followOffset.dot(frontRight), followOffset.dot(forward));
      const endAngle = Math.atan2(3.952, 5.016);
      const angle = startAngle + (endAngle - startAngle) * settle;
      const startRadius = Math.hypot(gap, 6.1), endRadius = Math.hypot(5.016, 3.952);
      const radius = startRadius + (endRadius - startRadius) * settle;
      position = car.clone().addScaledVector(forward, Math.cos(angle) * radius)
        .addScaledVector(frontRight, Math.sin(angle) * radius);
      position.y = 1.03 + 0.62 * settle;
      fov = 22 + 21 * settle;
    }
    const target = car.clone().addScaledVector(forward, 0.15 * (1 - settle));
    target.y = 0.04;
    return {position, target, up: new THREE.Vector3(0, 1, 0), fov};
  };
}
