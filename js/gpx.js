export class GPX {
  static parse(gpxText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxText, "text/xml");
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      throw new Error("Invalid XML format in GPX file");
    }
    const trackPoints = xmlDoc.getElementsByTagName("trkpt");
    const points = [];
    for (let i = 0; i < trackPoints.length; i++) {
      const point = trackPoints[i];
      const latStr = point.getAttribute("lat");
      const lonStr = point.getAttribute("lon");
      if (!latStr || !lonStr) continue;
      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);
      if (
        isNaN(lat) ||
        isNaN(lon) ||
        Math.abs(lat) > 90 ||
        Math.abs(lon) > 180
      ) {
        continue;
      }
      const timeElement = point.getElementsByTagName("time")[0];
      let timestamp = null;
      if (timeElement) {
        const timeStr = timeElement.textContent;
        if (timeStr) {
          timestamp = new Date(timeStr);
          if (isNaN(timestamp.getTime())) {
            timestamp = null;
          }
        }
      }
      points.push({
        lat: lat,
        lon: lon,
        time: timestamp,
        index: points.length,
      });
    }
    return points;
  }

  static calculateTrackLength(points) {
    if (!points || points.length < 2) return 0;
    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
      totalDistance += this.calculateDistance(
        points[i - 1].lat,
        points[i - 1].lon,
        points[i].lat,
        points[i].lon,
      );
    }
    return totalDistance / 1000; // Convert to kilometers
  }

  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  static generateGPXFromTrack(raceTrack) {
    if (!raceTrack || raceTrack.length === 0) {
      return null;
    }
    const now = new Date();
    const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Race Against Myself" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Race Track - ${now.toISOString().split("T")[0]}</name>
    <time>${now.toISOString()}</time>
  </metadata>
  <trk>
    <name>My Race</name>
    <trkseg>
${raceTrack
  .map(
    (point) => `      <trkpt lat="${point.lat}" lon="${point.lon}">
        <time>${point.timestamp.toISOString()}</time>
      </trkpt>`,
  )
  .join("\n")}
    </trkseg>
  </trk>
</gpx>`;
    return gpxContent;
  }
}
