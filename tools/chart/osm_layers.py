"""OpenStreetMap and OpenSeaMap as chart layers, for a port with no free official electronic chart.

osm_cell(REG, OUT, get) queries Overpass for the region's box and writes OSM_<LAYER>.geojson (lon/lat) in the
S-57 layer names build_region.py reads, so a port drawn from open data goes through the same builder:

  LNDARE  land: the coastline (land on its left, as OSM draws it) closed against the box into polygons
  SLCONS  breakwaters (1), piers and pontoons (4), and the quay faces inside the region's depth areas (6, wharf)
  MORFAC  quay bollards and mooring rings (3); mooring buoys (7)
  BERTHS  the port's numbered berths (points, OBJNAM = the number)
  LIGHTS, BOYLAT, BOYSPP, BCNISD, BCNLAT  lights and marks from the seamark:* tags
  UWTROC, WRECKS, OBSTRN  rocks, wrecks and obstructions
  DEPARE  the region's depth areas ("depths" in the region file): published depth ranges, each with its source.
          No soundings are made up: the chart shows the range, the depth grid holds the water within it.

Data © OpenStreetMap contributors, ODbL 1.0. Not an official chart.
"""
import json, os, urllib.parse
import shapely
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import polygonize, unary_union, linemerge

MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
           'https://overpass.kumi.systems/api/interpreter']
CHR = {'F': 1, 'Fl': 2, 'LFl': 3, 'Q': 4, 'VQ': 5, 'UQ': 6, 'Iso': 7, 'Oc': 8, 'IQ': 9, 'Mo': 12, 'FFl': 13, 'Al.Fl': 2, 'Al.Oc': 8}
COLOUR = {'white': 1, 'black': 2, 'red': 3, 'green': 4, 'blue': 5, 'yellow': 6, 'grey': 7, 'brown': 8, 'amber': 9, 'violet': 10, 'orange': 11, 'magenta': 12, 'pink': 13}
SHAPE = {'conical': 1, 'can': 2, 'spherical': 3, 'pillar': 4, 'spar': 5, 'barrel': 6, 'super-buoy': 7}


def _query(bb):
    s, w, n, e = bb
    b = f'{s},{w},{n},{e}'
    return f"""[out:json][timeout:240];
(
  way["natural"="coastline"]({b});
  way["man_made"~"^(pier|breakwater|groyne|quay)$"]({b}); relation["man_made"~"^(pier|breakwater)$"]({b});
  nwr["seamark:type"]({b});
  nwr["amenity"="ferry_terminal"]({b});
);
out body geom qt;"""


def _fetch(bb, get):
    q = urllib.parse.urlencode({'data': _query(bb)})
    last = None
    for url in MIRRORS:
        try: return json.loads(get(url + '?' + q, tries=2))
        except Exception as ex: last = ex; print('overpass', url, ex)
    raise last


def _geom(el):
    if el['type'] == 'node': return Point(el['lon'], el['lat'])
    g = el.get('geometry') or []
    if len(g) < 2: return None
    ln = LineString([(p['lon'], p['lat']) for p in g])
    closed = ln.coords[0] == ln.coords[-1] and len(ln.coords) >= 4
    t = el.get('tags', {})
    if closed and (t.get('area') == 'yes' or t.get('man_made') in ('breakwater', 'pier') and t.get('area') != 'no' and ln.length > 0):
        p = Polygon(ln.coords)
        return p if p.is_valid and p.area > 0 else ln
    return ln


def _land(coast, region):
    """The coastline (land on the left of each way) closed against the region box into land polygons."""
    lines = []
    for ln in coast:
        c = ln.intersection(region)
        for part in (getattr(c, 'geoms', None) or [c]):
            if part.geom_type == 'LineString' and part.length > 0: lines.append(part)
    edges = unary_union(lines + [region.boundary])
    faces = list(polygonize(edges))
    # a point a hair to the left of a coastline segment is land, to the right water
    eps = 2e-6
    lefts, rights = [], []
    for ln in lines:
        cs = list(ln.coords)
        for (x0, y0), (x1, y1) in zip(cs, cs[1:]):
            dx, dy = x1 - x0, y1 - y0; L = (dx * dx + dy * dy) ** 0.5
            if L < 1e-7: continue
            mx, my = (x0 + x1) / 2, (y0 + y1) / 2
            lefts.append(Point(mx - dy / L * eps, my + dx / L * eps)); rights.append(Point(mx + dy / L * eps, my - dx / L * eps))
    land = []
    for f in faces:
        pf = shapely.prepared.prep(f)
        nl = sum(1 for p in lefts if pf.contains(p)); nr = sum(1 for p in rights if pf.contains(p))
        if nl > nr: land.append(f)
    return unary_union(land) if land else Polygon()


def osm_cell(REG, OUT, get):
    S, W, N, E = REG['bbox']
    pad = 0.01
    d = _fetch((S - pad, W - pad, N + pad, E + pad), get)
    json.dump(d, open(os.path.join(OUT, 'osm.json'), 'w'), separators=(',', ':'))
    region = box(W, S, E, N)
    out = {}
    def add(L, g, props):
        if g is None or g.is_empty: return
        if not g.within(region):
            g = g.intersection(region)
            if g.is_empty: return
        out.setdefault(L, []).append({'type': 'Feature', 'properties': props, 'geometry': mapping(g)})
    coast, piers = [], []
    for el in d['elements']:
        t = el.get('tags', {}); g = _geom(el)
        if g is None: continue
        if t.get('natural') == 'coastline' and g.geom_type == 'LineString': coast.append(g); continue
        mm = t.get('man_made')
        if mm in ('breakwater', 'groyne'):
            add('SLCONS', g, {'CATSLC': 1 if mm == 'breakwater' else 2, **({'OBJNAM': t['name']} if t.get('name') else {})}); continue
        if mm in ('pier', 'quay'):
            add('SLCONS', g, {'CATSLC': 4 if mm == 'pier' else 6, **({'OBJNAM': t['name']} if t.get('name') else {})}); piers.append(g); continue
        st = t.get('seamark:type')
        if t.get('amenity') == 'ferry_terminal' and t.get('ref') and g.geom_type == 'Point':
            add('BERTHS', g, {'OBJNAM': t['ref']}); continue
        if not st: continue
        if st == 'mooring' and g.geom_type == 'Point':
            cat = t.get('seamark:mooring:category')
            add('MORFAC', g, {'CATMOR': 7 if cat == 'buoy' else 1 if cat == 'dolphin' else 3}); continue
        if st in ('rock',): add('UWTROC', g, {}); continue
        if st in ('wreck',): add('WRECKS', g, {}); continue
        if st == 'obstruction': continue                                 # booms and nets: no part of a ship's chart
        light = {}
        for pre in ('seamark:light:', 'seamark:light:1:'):
            if t.get(pre + 'character') or t.get(pre + 'colour'):
                light = {'LITCHR': CHR.get(t.get(pre + 'character', 'F'), 1), 'COLOUR': [COLOUR.get(c, 1) for c in t.get(pre + 'colour', 'white').split(';')]}
                if t.get(pre + 'group'): light['SIGGRP'] = '(' + t[pre + 'group'] + ')'
                for k, v in (('period', 'SIGPER'), ('height', 'HEIGHT'), ('range', 'VALNMR'), ('sector_start', 'SECTR1'), ('sector_end', 'SECTR2')):
                    try: light[v] = float(t[pre + k])
                    except (KeyError, ValueError): pass
                break
        name = t.get('seamark:name') or t.get('name')
        if light and g.geom_type == 'Point': add('LIGHTS', g, {**light, **({'OBJNAM': name} if name else {})})
        if st.startswith(('buoy_', 'beacon_')) and g.geom_type == 'Point':
            kind = st.split('_', 1)[1]
            L = ('BOY' if st.startswith('buoy') else 'BCN') + {'lateral': 'LAT', 'cardinal': 'CAR', 'isolated_danger': 'ISD', 'safe_water': 'SAW', 'special_purpose': 'SPP'}.get(kind, 'SPP')
            p = {'COLOUR': [COLOUR.get(c, 7) for c in t.get(f'seamark:{st}:colour', 'yellow').split(';')]}
            cat = t.get(f'seamark:{st}:category')
            if cat in ('port', 'starboard'): p['CATLAM'] = 1 if cat == 'port' else 2
            if t.get(f'seamark:{st}:shape') in SHAPE: p['BOYSHP' if L.startswith('BOY') else 'BCNSHP'] = SHAPE[t[f'seamark:{st}:shape']]
            if name: p['OBJNAM'] = name
            add(L, g, p)
    land = _land(coast, region)
    for q in (getattr(land, 'geoms', None) or [land]):
        if q.geom_type == 'Polygon' and q.area > 0: add('LNDARE', q, {})
    # the region's depth areas: published depths for the harbour, held across each area; their quay faces are wharves
    water = region.difference(land)
    for a in REG['sources']['osm'].get('depths', []):
        poly = Polygon([(lon, lat) for lat, lon in a['poly']]).intersection(water)
        if poly.is_empty: continue
        add('DEPARE', poly, {'DRVAL1': a['d1'], 'DRVAL2': a['d2'], 'SORIND': a['src']})
        if a.get('quays'):
            edge = land.boundary.intersection(poly.buffer(0.0002))
            for ln in (getattr(edge, 'geoms', None) or [edge]):
                if ln.geom_type == 'LineString' and ln.length > 0: add('SLCONS', ln, {'CATSLC': 6})
    # names of the piers and quays (where the numbered berths are), for the berth list
    for pl in REG['sources']['osm'].get('places', []):
        add('SLCONS', Point(pl['at'][1], pl['at'][0]).buffer(0.00005).exterior, {'CATSLC': 6, 'OBJNAM': pl['name']})
    info = {'cell': 'OSM', 'source': 'osm', 'layers': {}, 'DSID_ISDT': None}
    for L, feats in out.items():
        json.dump({'type': 'FeatureCollection', 'features': feats}, open(os.path.join(OUT, f'OSM_{L}.geojson'), 'w'), separators=(',', ':'))
        info['layers'][L] = len(feats)
    return info
