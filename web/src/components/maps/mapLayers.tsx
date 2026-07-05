import { LayerSpecification } from 'mapbox-gl';

interface MapLayers {
  layerId: string;
  name?: string;
  checked: boolean;
  added: boolean;
}

export const baciasFills: LayerSpecification = {
  id: 'bacias-fills',
  type: 'fill',
  source: 'bacias',
  layout: {
    // Make the layer visible by default.
    visibility: 'visible'
  },
  paint: {
    'fill-color': '#627BC1',
    'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.7, 0.3]
  }
};

export const baciasBorders: LayerSpecification = {
  id: 'bacias-borders',
  type: 'line',
  source: 'bacias',
  layout: {
    // Make the layer visible by default.
    visibility: 'visible'
  },
  paint: {
    'line-color': '#627BC1',
    'line-width': 2
  }
};

export const baciasFills2: LayerSpecification = {
  id: 'bacias2-fills',
  type: 'fill',
  source: 'bacias2',
  layout: {
    // Make the layer visible by default.
    visibility: 'visible'
  },
  paint: {
    'fill-color': '#627BC1',
    'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.7, 0.3]
  }
};

export const baciasBorders2: LayerSpecification = {
  id: 'bacias2-borders',
  type: 'line',
  source: 'bacias2',
  layout: {
    // Make the layer visible by default.
    visibility: 'visible'
  },
  paint: {
    'line-color': '#627BC1',
    'line-width': 2
  }
};

export const majorRivers: LayerSpecification = {
  id: 'rivers',
  type: 'line',
  source: 'rivers',
  layout: {
    // Make the layer visible by default.
    visibility: 'visible'
  },
  paint: {
    'line-color': '#2196F3',
    'line-width': 3
  }
};

export const satLayer: LayerSpecification = {
  id: 'heatmapRain',
  type: 'raster',
  source: 'heatmapRain',
  paint: {
    'raster-fade-duration': 0
  },
  layout: {
    // Make the layer visible by default.  lat -24.1632, long -37.4742   lat -20.8888   long -47.4742
    visibility: 'none'
  }
};

export const unclusteredPoint: LayerSpecification = {
  id: 'unclustered-point',
  type: 'symbol',
  source: 'stationIcons',
  filter: ['!', ['has', 'point_count']],
  layout: {
    'icon-image': ['get', 'type'], // reference the image and type station in geojson
    'icon-size': 0.25,
    visibility: 'visible'
  }
};

export const clusterCount: LayerSpecification = {
  id: 'cluster-count',
  type: 'symbol',
  source: 'stationIcons',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    'text-size': 12,
    visibility: 'visible'
  }
};

export const clusters = {
  id: 'clusters',
  type: 'circle',
  source: 'stationIcons',
  filter: ['has', 'point_count'],
  layout: {
    visibility: 'visible'
  },
  paint: {
    // Use step expressions (https://maplibre.org/maplibre-gl-js-docs/style-spec/#expressions-step)
    // with three steps to implement three types of circles:
    //   * Blue, 20px circles when point count is less than 100
    //   * Yellow, 30px circles when point count is between 100 and 750
    //   * Pink, 40px circles when point count is greater than or equal to 750
    'circle-color': ['step', ['get', 'point_count'], '#51bbd6', 100, '#0099FF', 750, '#00CCFF'],
    'circle-radius': ['step', ['get', 'point_count'], 25, 100, 35, 750, 40]
  }
};

export const addSubBasins = (
  map: mapboxgl.Map,
  toggleSpinner: () => void,
  stopSpinner: (e: any) => void
) => {
  toggleSpinner();

  map.addSource('bacias', {
    type: 'geojson',
    data: '/data/geojson/subbacias.geojson'
  });
  //loadingSpinner(true);
  map.addLayer(baciasBorders, 'z-index-1');
  map.addLayer(baciasFills, 'z-index-1');
  map.on('render', stopSpinner);
};

export const addMajorBasins = (
  map: mapboxgl.Map,
  toggleSpinner: () => void,
  stopSpinner: (e: any) => void
) => {
  toggleSpinner();

  map.addSource('bacias2', {
    type: 'geojson',
    data: '/data/geojson/bacias.geojson'
  });
  //loadingSpinner(true);
  map.addLayer(baciasBorders2, 'z-index-1');
  map.addLayer(baciasFills2, 'z-index-1');
  map.on('render', stopSpinner);
};

export const addRivers = (
  map: mapboxgl.Map,
  toggleSpinner: () => void,
  stopSpinner: (e: any) => void
) => {
  toggleSpinner();

  map.addSource('rivers', {
    type: 'geojson',
    data: '/data/geojson/rivers.geojson'
  });
  //loadingSpinner(true);
  map.addLayer(majorRivers, 'z-index-1');
  map.on('render', stopSpinner);
};

export const toggleMapLayers = (
  layer: MapLayers,
  map: mapboxgl.Map,
  toggleSpinner: () => void,
  stopSpinner: (e: any) => void
) => {
  const added = layer.added;
  const checked = layer.checked;
  const layerId = layer.layerId;

  if (map != undefined) {
    if (!added && layerId === 'rivers') {
      addRivers(map, toggleSpinner, stopSpinner);
    } else if (!added && layerId === 'bacias2') {
      addMajorBasins(map, toggleSpinner, stopSpinner);
    } else if (!added && layerId === 'bacias') {
      addSubBasins(map, toggleSpinner, stopSpinner);
    } else if (!added && layerId === 'heatmapRain') {
      addRasterLayer(map);
    } else {
      if (layer.layerId === 'bacias2' || layer.layerId === 'bacias') {
        const basinVisibility = map.getLayoutProperty(layer.layerId + '-fills', 'visibility');

        if (basinVisibility === 'visible') {
          map.setLayoutProperty(layer.layerId + '-fills', 'visibility', 'none');
          map.setLayoutProperty(layer.layerId + '-borders', 'visibility', 'none');
        } else {
          map.setLayoutProperty(layer.layerId + '-fills', 'visibility', 'visible');
          map.setLayoutProperty(layer.layerId + '-borders', 'visibility', 'visible');
        }
      } else {
        const layerIdVisibility = map.getLayoutProperty(layer.layerId, 'visibility');

        if (layerIdVisibility === 'visible') {
          map.setLayoutProperty(layer.layerId, 'visibility', 'none');
        } else {
          map.setLayoutProperty(layer.layerId, 'visibility', 'visible');
        }
      }
    }
  }
};

export const toggleClustersLayer = (map: mapboxgl.Map) => {
  const clusterVisibility = map.getLayoutProperty('cluster-count', 'visibility');

  if (clusterVisibility === 'visible') {
    map.setLayoutProperty('clusters', 'visibility', 'none');
    map.setLayoutProperty('cluster-count', 'visibility', 'none');
    map.setLayoutProperty('unclustered-point', 'visibility', 'none');
  } else {
    map.setLayoutProperty('clusters', 'visibility', 'visible');
    map.setLayoutProperty('cluster-count', 'visibility', 'visible');
    map.setLayoutProperty('unclustered-point', 'visibility', 'visible');
  }
};

export const addRasterLayer = (map: mapboxgl.Map) => {
  map.addSource('heatmapRain', {
    type: 'image',
    url: '/images/prec/overall/precp0.png',
    coordinates: [
      [-120.1, 32.3], //NW LEFT TOP   LONGITUDE(LESTE,OESTE,DIREITA,ESQUERDA), LATITUDE(NORTE,SUL,CIMA,BAIXO)
      [-20, 32.3], //NE RIGHT TOP
      [-20, -60.1], //RIGHT BOTTOM SE     -50 LATITUDE BAIXA
      [-120.1, -60.1] //LEFT BOTTOM SW      -50 LATITUDE BAIXA
    ]
  });
  map.addLayer(satLayer);
};
