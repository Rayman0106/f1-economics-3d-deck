/* Daylight, trackside materials, and stable leaf coverage for the J candidate. */
window.F1MaterialJ = (() => {
  let THREE, renderer, scene, sun, skySource, skyYaw, reflection, reflectionStats;
  let track = 0, enabled = true, mode = 'broadcast', lastPaintWeight = -1;
  let leafFiltering = true;
  const reflections = { value: null };
  const reflectionWeight = { value: 0 };
  const buildingWeight = { value: 0 };
  const daylightWeight = { value: 0 };
  const broadcastWeight = { value: 0 };
  const leafCoverage = { value: 0 };
  const records = new Map();
  const modes = ['baseline', 'buildings', 'reflection', 'complete', 'daylight', 'broadcast'];
  const paint = [];

  function setup(three, render, world, light) {
    THREE = three;
    renderer = render;
    scene = world;
    sun = light;
  }

  function filterLeaves(material) {
    const previous = material.onBeforeCompile;
    const cacheKey = material.customProgramCacheKey();
    material.onBeforeCompile = function(shader, render) {
      previous.call(this, shader, render);
      shader.uniforms.jLeafCoverage = leafCoverage;
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
        #include <common>
        uniform float jLeafCoverage;
      `).replace('#include <alphatest_fragment>', `
        #if defined(USE_MAP) && defined(USE_ALPHATEST) && defined(ALPHA_TO_COVERAGE)
          if (jLeafCoverage > .5) {
            float leafAlpha = diffuseColor.a;
            vec2 leafDx = dFdx(vMapUv), leafDy = dFdy(vMapUv);
            float leafFootprint = max(dot(leafDx, leafDx), dot(leafDy, leafDy));
            float leafFar = smoothstep(1. / (96. * 96.), 1. / (24. * 24.), leafFootprint);
            float leafCutout = smoothstep(alphaTest, alphaTest + max(fwidth(leafAlpha), .00001), leafAlpha);
            // A minified mip's alpha represents fractional leaf coverage.
            diffuseColor.a = mix(leafCutout, leafAlpha, leafFar);
            if (diffuseColor.a <= 0.) discard;
          } else {
            #include <alphatest_fragment>
          }
        #else
          #include <alphatest_fragment>
        #endif
      `);
    };
    material.customProgramCacheKey = () => cacheKey + '-monza-j-leaf-coverage';
    material.needsUpdate = true;
  }

  function renderWorld(camera, opaqueSky) {
    const filtered = leafFiltering && opaqueSky && renderer.getRenderTarget().samples > 1;
    leafCoverage.value = filtered ? 1 : 0;
    try {
      renderer.render(scene, camera);
    } finally {
      leafCoverage.value = 0;
    }
    return filtered;
  }

  // The sky PMREM has already been made from the unaltered source. Hold the
  // decoded HDR until the additional reflection capture, then dispose it.
  function retainSky(texture, yaw) {
    skySource = texture;
    skyYaw = yaw;
  }

  function softenSolarDisk(texture) {
    // The source sun reaches about 60,000 in linear light. The direct sun is
    // already in the rig. Roll off only HDR peaks so a subpixel sun cannot
    // produce an unstable white dot in the low-roughness clearcoat.
    const pixels = texture.image.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const luminance = .2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2];
      if (luminance <= 2) continue;
      const gain = (2 + 10 * -Math.expm1(-(luminance - 2) / 10)) / luminance;
      pixels[i] *= gain;
      pixels[i + 1] *= gain;
      pixels[i + 2] *= gain;
    }
    texture.needsUpdate = true;
  }

  async function capture(roots) {
    if (!skySource) throw new Error('J HDR sky was not retained for reflection');
    const began = performance.now();
    const sky = roots.find(root => root.name === 'Daylight_sky');
    const background = scene.background;
    const rotation = scene.backgroundRotation.clone();
    const intensity = scene.backgroundIntensity;
    const blur = scene.backgroundBlurriness;
    const shadows = renderer.shadowMap.enabled;
    const toneMapping = renderer.toneMapping;
    const hidden = [];
    const hide = object => {
      if (object.visible) {
        hidden.push(object);
        object.visible = false;
      }
    };
    const target = new THREE.WebGLCubeRenderTarget(256, {
      type: THREE.HalfFloatType, generateMipmaps: false, colorSpace: THREE.LinearSRGBColorSpace
    });
    const camera = new THREE.CubeCamera(.15, 1600, target);
    camera.position.copy(sun.target.position);
    camera.position.y = 1.35;
    const generator = new THREE.PMREMGenerator(renderer);
    try {
      for (const child of scene.children) if (!child.isLight && !roots.includes(child)) hide(child);
      for (const root of roots) root.traverseVisible(object => {
        if (object.isMesh && /_grass_/i.test(object.name)) hide(object);
      });
      if (sky) hide(sky);
      softenSolarDisk(skySource);
      scene.background = skySource;
      scene.backgroundRotation.set(0, skyYaw, 0);
      scene.backgroundIntensity = 1;
      scene.backgroundBlurriness = 0;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.needsUpdate = true;
      camera.update(renderer, scene);
      reflection = generator.fromCubemap(target.texture);
      reflections.value = reflection.texture;
      reflectionStats = {
        cubeSize: target.width,
        atlasSize: [reflection.width, reflection.height],
        position: camera.position.toArray(),
        shadowMapSize: sun.shadow.map?.width || 0,
        skyYaw,
        captureMs: performance.now() - began
      };
      if (window.F1ReviewMode) {
        const face = new Uint16Array(target.width * target.height * 4);
        try {
          await renderer.readRenderTargetPixelsAsync(target, 0, 0, target.width, target.height, face, 2);
          reflectionStats.sky = window.F1GlobalJ.measureFace(face, 2);
        } catch (error) {
          reflectionStats.skySampleError = String(error);
        }
      }
    } finally {
      for (const object of hidden) object.visible = true;
      scene.background = background;
      scene.backgroundRotation.copy(rotation);
      scene.backgroundIntensity = intensity;
      scene.backgroundBlurriness = blur;
      renderer.toneMapping = toneMapping;
      renderer.shadowMap.enabled = shadows;
      renderer.shadowMap.needsUpdate = true;
      generator.dispose();
      skySource.dispose();
      skySource = null;
      target.dispose();
    }
  }

  function family(mesh, material) {
    if (material.isMeshPhysicalMaterial && material.userData.f1SurfaceProfile?.family === 'paint') return 'paint';
    if (/^Imported_Monza_glass_B005_/.test(mesh.name) && /^glass_B\.005\b/.test(material.name)) return 'glass';
    if (/^Imported_Monza_metals005_/.test(mesh.name) && /^metals\.005\b/.test(material.name)) return 'metal';
    if (/^Pale precast grandstand end walls H$/.test(material.name)) return 'precast';
    if (/^Textured grandstand concrete H$/.test(material.name)) return 'stand';
    if (/^Imported_Monza_(?:H_clean_)?walls005_/.test(mesh.name) && /^walls\.005\b/.test(material.name)) return 'wall';
    return null;
  }

  function finishReflection(shader, usesHDR) {
    shader.uniforms.jDaylightWeight = daylightWeight;
    const source = THREE.ShaderChunk.envmap_physical_pars_fragment;
    const diffuse = 'return PI * envMapColor.rgb * envMapIntensity;';
    if (!source.includes(diffuse)) throw new Error('J diffuse irradiance shader anchor changed');
    let lighting = source.replace(diffuse, 'return PI * envMapColor.rgb * envMapIntensity * (1. - .34 * jDaylightWeight);');
    const sample = 'vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );';
    if (usesHDR) {
      if (!lighting.includes(sample)) throw new Error('J reflection shader anchor changed');
      shader.uniforms.jReflection = reflections;
      shader.uniforms.jReflectionWeight = reflectionWeight;
      lighting = lighting.replace(sample, `
        vec4 envMapColor;
        if (jReflectionWeight >= .9999) {
          envMapColor = textureCubeUV(jReflection, reflectVec, roughness);
        } else {
          envMapColor = textureCubeUV(envMap, envMapRotation * reflectVec, roughness);
          if (jReflectionWeight > .0001) {
            envMapColor = mix(envMapColor, textureCubeUV(jReflection, reflectVec, roughness), jReflectionWeight);
          }
        }
      `);
    }
    shader.fragmentShader = shader.fragmentShader.replace('#include <envmap_physical_pars_fragment>', `
      uniform float jDaylightWeight;
      ${usesHDR ? 'uniform sampler2D jReflection; uniform float jReflectionWeight;' : ''}
      ${lighting}
    `);
  }

  function addConcreteDetail(shader) {
    shader.uniforms.jBuildingWeight = buildingWeight;
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      uniform float jBuildingWeight;
    `).replace('#include <map_fragment>', `
      #include <map_fragment>
      #ifdef USE_MAP
        // Use the existing colour sample. Keep the atlas and authored UVs.
        float jGrain = dot(sampledDiffuseColor.rgb, vec3(.2126, .7152, .0722));
        diffuseColor.rgb *= 1. + .14 * jBuildingWeight * clamp((jGrain - .19) * 3., -.5, .5);
      #endif
    `);
    const worldRoughness = 'roughnessFactor=clamp(roughnessFactor*(.87+.22*dtR),.45,1.);';
    if (shader.fragmentShader.includes(worldRoughness)) {
      shader.fragmentShader = shader.fragmentShader.replace(worldRoughness, `${worldRoughness}
        roughnessFactor = mix(roughnessFactor, clamp(.83 + (dtR - .76) * 1.9, .73, .95), jBuildingWeight);
      `);
    } else {
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        #ifdef USE_ROUGHNESSMAP
          roughnessFactor = mix(roughnessFactor, clamp(.83 + (roughnessFactor - .74) * 1.9, .73, .95), jBuildingWeight);
        #endif
      `);
    }
  }

  function register(mesh, material) {
    if (!material?.isMeshStandardMaterial || records.has(material)) return;
    const role = family(mesh, material);
    if (!role) return;
    const reflective = role === 'paint' || role === 'glass' || role === 'metal';
    // The native CubeUV shader uses compile-time atlas dimensions. Materials
    // with another atlas size keep their existing environment sampling.
    const image = (material.envMap || scene.environment)?.image;
    const usesHDR = reflective && !!reflection && image?.width === reflection.width && image?.height === reflection.height;
    const record = { material, role, example: mesh.name, base: {
      color: material.color.clone(), normalScale: material.normalScale.clone(),
      emissiveIntensity: material.emissiveIntensity, roughness: material.roughness,
      clearcoatRoughness: material.clearcoatRoughness
    }, usesHDR };
    records.set(material, record);
    if (role === 'paint') paint.push(record);
    const previous = material.onBeforeCompile;
    const cacheKey = material.customProgramCacheKey;
    material.onBeforeCompile = function(shader, render) {
      previous.call(this, shader, render);
      if (reflective) finishReflection(shader, usesHDR);
      else addConcreteDetail(shader);
    };
    material.customProgramCacheKey = function() { return cacheKey.call(this) + '-monza-j-finish-' + role + '-' + usesHDR; };
    material.needsUpdate = true;
  }

  function applyBuildings() {
    const amount = enabled && mode !== 'baseline' ? 1 : 0;
    buildingWeight.value = amount;
    for (const { material, role, base } of records.values()) {
      if (role === 'paint') continue;
      material.color.copy(base.color);
      material.normalScale.copy(base.normalScale);
      material.roughness = base.roughness;
      material.emissiveIntensity = base.emissiveIntensity;
      if (!amount) continue;
      if (role === 'glass') {
        // Keep the BLEND alpha atlas and dark interior; darken the tint so the
        // view-dependent Fresnel reflection reads through the window frame.
        material.color.r *= .58;
        material.color.g *= .64;
        material.color.b *= .70;
        material.roughness = .075;
      } else if (role === 'metal') {
        // The source atlas includes painted hardware as well as bare metal.
        material.roughness = .38;
      } else {
        const strength = role === 'stand' ? 1.45 : role === 'precast' ? 1.8 : 1.23;
        material.normalScale.multiplyScalar(strength);
        if (role === 'precast') material.emissiveIntensity = .08;
      }
    }
  }

  function frame(alpha) {
    track = alpha;
    const amount = enabled ? THREE.MathUtils.smoothstep(alpha, .01, .98) : 0;
    const daylight = mode === 'daylight' || mode === 'broadcast' ? amount : 0;
    daylightWeight.value = daylight;
    broadcastWeight.value = mode === 'broadcast' ? amount : 0;
    if (enabled) {
      sun.intensity = 2.6 + .65 * daylight;
      scene.environmentIntensity = THREE.MathUtils.lerp(.56, .50, alpha) - .08 * daylight;
    }
    reflectionWeight.value = reflection && modes.indexOf(mode) >= 2 ? amount : 0;
    const paintWeight = mode === 'complete' ? amount : daylight;
    if (lastPaintWeight === paintWeight) return;
    lastPaintWeight = paintWeight;
    for (const { material, base } of paint) {
      material.roughness = THREE.MathUtils.lerp(base.roughness, .39, paintWeight);
      material.clearcoatRoughness = THREE.MathUtils.lerp(base.clearcoatRoughness, .075, paintWeight);
    }
  }

  function apply() {
    applyBuildings();
    lastPaintWeight = -1;
    frame(track);
  }

  function setMode(value) {
    if (!modes.includes(value)) throw new RangeError('Unknown material comparison: ' + value);
    mode = value;
    apply();
  }

  function setEnabled(value) {
    enabled = value;
    apply();
  }

  async function prepare(roots) {
    try {
      await capture(roots);
    } catch (error) {
      reflection?.dispose();
      reflection = null;
      reflections.value = null;
      reflectionStats = { error: String(error) };
      console.warn('J HDR reflection preparation failed. Using the existing reflection.', error);
    }
    scene.traverse(mesh => {
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) register(mesh, material);
    });
    apply();
  }

  function state() {
    const counts = {}, hdrMaterials = {}, samples = {};
    for (const { material, role, example, usesHDR } of records.values()) {
      counts[role] = (counts[role] || 0) + 1;
      if (usesHDR) hdrMaterials[role] = (hdrMaterials[role] || 0) + 1;
      samples[role] ??= { mesh: example, material: material.name, roughness: material.roughness,
        clearcoatRoughness: material.clearcoatRoughness, emissiveIntensity: material.emissiveIntensity,
        normalScale: material.normalScale.toArray(), transparent: material.transparent, depthWrite: material.depthWrite };
    }
    const visible = {};
    scene.traverseVisible(mesh => {
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!material || !material.visible) continue;
        const role = family(mesh, material);
        if (!role) continue;
        const row = visible[role] ??= { meshes: 0, upgraded: 0 };
        row.meshes++;
        if (records.has(material)) row.upgraded++;
      }
    });
    return { mode, track, reflectionWeight: reflectionWeight.value, daylightWeight: daylightWeight.value,
      broadcastWeight: broadcastWeight.value,
      sunIntensity: sun?.intensity, environmentIntensity: scene?.environmentIntensity, leafFiltering,
      counts, hdrMaterials, visible, samples, reflection: reflectionStats,
      runtimeCubeRenders: 0, additionalDrawPasses: 0 };
  }

  return { setup, retainSky, prepare, frame, setMode, setEnabled, state, daylightWeight, broadcastWeight,
    get mode() { return mode; },
    filterLeaves, renderWorld, setLeafFiltering(value) { leafFiltering = !!value; }
  };
})();
