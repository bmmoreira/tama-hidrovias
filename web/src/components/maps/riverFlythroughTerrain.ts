import mapboxgl from 'mapbox-gl';
import * as THREE from 'three';

/**
 * Step one of a real-time 3D riverbed wireframe (see
 * architecture/river_flythrough.rst's "3D riverbed wireframe (prototype)"
 * section): a single static chunk of real, sampled depth data rendered as a
 * Three.js wireframe inside a Mapbox custom layer, to prove the mechanics
 * (GeoTIFF sampling, Mapbox/Three.js camera sync, vertical exaggeration)
 * before attempting progressive chunk streaming along the flight path.
 *
 * Not wired to the flythrough's camera position at all yet -- it's added
 * once, at a fixed location, when the flight starts, and stays there.
 */

export interface DepthChunk {
  width: number;
  height: number;
  /** [minLng, minLat, maxLng, maxLat] */
  bounds: [number, number, number, number];
  /** Row-major (row 0 = north edge, matching raster convention), null = nodata. */
  values: (number | null)[];
}

/**
 * Fetches a small, regular grid of real depth samples from a bathymetry
 * GeoTIFF via `/api/bathymetry/raster-grid` (which crops+decodes server-side
 * -- see that route) rather than fetching a whole raster or the rendered
 * PNG tiles the rest of the forecast system uses; a wireframe needs actual
 * numeric vertices, not pixel colors.
 */
export async function fetchDepthChunk(
  slug: string,
  bounds: [number, number, number, number],
  size = 64,
): Promise<DepthChunk> {
  const url = new URL('/api/bathymetry/raster-grid', window.location.origin);
  url.searchParams.set('slug', slug);
  url.searchParams.set('bbox', bounds.join(','));
  url.searchParams.set('size', String(size));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch depth chunk: ${response.status}`);
  }
  const json = (await response.json()) as { data: DepthChunk };
  return json.data;
}

const EARTH_RADIUS_M = 6378137;

/** Equirectangular approximation (lng/lat degrees -> meters east/north of
 *  `origin`) -- accurate enough for a chunk a couple km across, and avoids
 *  pulling in a full geodesy library for this prototype. */
function metersFromOrigin(origin: [number, number], point: [number, number]): [number, number] {
  const [originLng, originLat] = origin;
  const [lng, lat] = point;
  const latRad = (originLat * Math.PI) / 180;
  const dx = ((lng - originLng) * Math.PI * EARTH_RADIUS_M * Math.cos(latRad)) / 180;
  const dy = ((lat - originLat) * Math.PI * EARTH_RADIUS_M) / 180;
  return [dx, dy];
}

/**
 * Builds a wireframe (LineSegments, not a solid mesh -- "3D wired
 * vertices," per the request this implements) in local meter space,
 * centered on `origin`. Vertical exaggeration is applied in the same
 * meter units as the horizontal axes, so it stays physically meaningful
 * once the model transform scales everything uniformly into Mercator
 * space (see `addRiverDepthWireframe` below) -- a vertex isn't "10x too
 * tall," it's "depth exaggerated 10x," which is the actual intent.
 */
function buildWireframeGeometry(
  chunk: DepthChunk,
  origin: [number, number],
  exaggeration: number,
): THREE.BufferGeometry {
  const { width, height, bounds, values } = chunk;
  const [minLng, minLat, maxLng, maxLat] = bounds;

  const positions: [number, number, number][] = new Array(width * height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const lng = minLng + ((col + 0.5) / width) * (maxLng - minLng);
      // Raster row 0 is the north edge.
      const lat = maxLat - ((row + 0.5) / height) * (maxLat - minLat);
      const [x, y] = metersFromOrigin(origin, [lng, lat]);
      const depth = values[row * width + col];
      // Below the water surface (negative Z), exaggerated for legibility --
      // real depths here (a few to ~20m) are imperceptible next to a
      // kilometers-wide chunk without this.
      const z = depth === null ? NaN : -depth * exaggeration;
      positions[row * width + col] = [x, y, z];
    }
  }

  const segments: number[] = [];
  const pushSegment = (a: [number, number, number], b: [number, number, number]) => {
    if (Number.isNaN(a[2]) || Number.isNaN(b[2])) return;
    segments.push(...a, ...b);
  };

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const here = positions[row * width + col];
      if (col < width - 1) pushSegment(here, positions[row * width + col + 1]);
      if (row < height - 1) pushSegment(here, positions[(row + 1) * width + col]);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
  return geometry;
}

export interface RiverDepthWireframeOptions {
  /** Forecast-tiles slug for the bathymetry GeoTIFF, e.g.
   *  "profundidade/TAPAJOS_BATHYMETRY_2023-12-05T00h00_wgs84". */
  slug: string;
  bounds: [number, number, number, number];
  /** Grid resolution per side (clamped server-side to 128). */
  size?: number;
  /** Depth multiplier for visual legibility -- see buildWireframeGeometry. */
  exaggeration?: number;
  color?: string;
}

/**
 * Adds a static riverbed wireframe layer to `map` for one fixed chunk and
 * returns a function that removes it. Follows Mapbox's standard "Three.js
 * custom layer" recipe: a model transform (translate + uniform scale, built
 * once from `MercatorCoordinate`) converts the geometry's local meter-space
 * vertices into Mercator space, combined every frame with the matrix Mapbox
 * itself provides -- see the `render` callback below.
 */
export async function addRiverDepthWireframe(
  map: mapboxgl.Map,
  layerId: string,
  options: RiverDepthWireframeOptions,
): Promise<() => void> {
  const { slug, bounds, size = 64, exaggeration = 12, color = '#22d3ee' } = options;

  const origin: [number, number] = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
  const chunk = await fetchDepthChunk(slug, bounds, size);
  const geometry = buildWireframeGeometry(chunk, origin, exaggeration);

  const originMercator = mapboxgl.MercatorCoordinate.fromLngLat(origin, 0);
  const metersToMercator = originMercator.meterInMercatorCoordinateUnits();

  // No rotation here, deliberately -- unlike Mapbox's standard "add a 3D
  // model" recipe (which rotates 90° around X to convert a typically Y-up
  // *authored* glTF/OBJ model into Mapbox's Z-up world), this geometry's
  // local axes are already (X = east, Y = north, Z = up) by construction
  // (see buildWireframeGeometry/metersFromOrigin above) -- adding that same
  // fixed rotation on top would tip an already Z-up grid onto its side,
  // which is exactly the "wireframe renders vertical, not flat on the
  // water" bug this comment is here to stop from being reintroduced.
  // Only the Y flip below (Mercator's Y axis runs opposite to this model's
  // "north is +Y") is actually needed.
  const modelTransform = {
    translateX: originMercator.x,
    translateY: originMercator.y,
    translateZ: originMercator.z,
    scale: metersToMercator,
  };

  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.Camera | null = null;

  const customLayer: mapboxgl.CustomLayerInterface = {
    id: layerId,
    type: 'custom',
    renderingMode: '3d',
    onAdd(_map, gl) {
      camera = new THREE.Camera();
      scene = new THREE.Scene();

      const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
      const lines = new THREE.LineSegments(geometry, material);
      scene.add(lines);

      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      renderer.autoClear = false;
    },
    render(gl, matrix) {
      if (!renderer || !scene || !camera) return;

      const m = new THREE.Matrix4().fromArray(matrix);
      const l = new THREE.Matrix4()
        .makeTranslation(modelTransform.translateX, modelTransform.translateY, modelTransform.translateZ)
        .scale(new THREE.Vector3(modelTransform.scale, -modelTransform.scale, modelTransform.scale));

      camera.projectionMatrix = m.multiply(l);
      renderer.resetState();
      renderer.render(scene, camera);
      map.triggerRepaint();
    },
    onRemove() {
      renderer?.dispose();
      geometry.dispose();
    },
  };

  map.addLayer(customLayer);

  return () => {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  };
}
