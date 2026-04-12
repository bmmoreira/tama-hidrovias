import { useRef, useEffect, useCallback } from 'react';
import Mapbox, { Source, Layer } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { MapStylePreference, Station } from '@/lib/strapi';


export function MainMap({ onStatsUpdate }) {



    return (
        <div className="h-full w-full relative">
            <Mapbox
                initialViewState={{
                    longitude: 0,
                    latitude: 0,
                    zoom: 2
                }}
                style={{ width: '100%', height: '100%' }}
                mapStyle="mapbox://styles/mapbox/streets-v11"
                onLoad={(evt) => {

                }}
                onMove={(evt) => {


                }}
                onClick={(evt) => {


                }}

            >
            </Mapbox>
        </div>
    );

}