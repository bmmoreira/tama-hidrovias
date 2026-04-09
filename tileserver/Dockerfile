FROM maptiler/tileserver-gl:latest
WORKDIR /data
COPY config.json /data/config.json
COPY styles/ /data/styles/
RUN mkdir -p /data/geotiffs /data/mbtiles /data/fonts /data/sprites /data/icons
EXPOSE 8080
CMD ["--config", "/data/config.json"]
