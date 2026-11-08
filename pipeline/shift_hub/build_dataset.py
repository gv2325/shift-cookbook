"""Turn the JSON blobs scraped from shift-transport.org's JS bundle into a clean,
provenance-tagged city dataset for design iteration.

Inputs  (data/): blob0 = dashboard tables (cityStatsByCity, ...), blob1 = layer availability,
                 blob2 = per-city profiles (Trip_Stats, Mode_Shares_PCT, Daily_Rhythm_*, Sources ...)
Outputs (data/): shift_cities.json  - full clean record per city (all 30)
                 mock_cities.json   - compact subset embedded in the design mockup
"""
import json, math, sys, os

D = sys.argv[1]
b0 = json.load(open(os.path.join(D, 'blob0_43-252.json')))
b1 = json.load(open(os.path.join(D, 'blob1_43-252.json')))
b2 = json.load(open(os.path.join(D, 'blob2_43-252.json')))

SRC = 'shift-transport.org JS bundle (chunk 43-252298f7259864d5.js), scraped 2026-11-08'
COORDS = {  # lat, lon (city centre, approximate)
    'Ahmedabad': (23.03, 72.58), 'Bengaluru': (12.97, 77.59), 'Bhopal': (23.26, 77.41),
    'Chennai': (13.08, 80.27), 'Coimbatore': (11.02, 76.96), 'Delhi': (28.61, 77.21),
    'Hyderabad': (17.39, 78.49), 'Indore': (22.72, 75.86), 'Jaipur': (26.91, 75.79),
    'Kanpur': (26.45, 80.33), 'Kochi': (9.93, 76.27), 'Kolkata': (22.57, 88.36),
    'Kozhikode': (11.26, 75.78), 'Lucknow': (26.85, 80.95), 'Mumbai': (19.08, 72.88),
    'Nagpur': (21.15, 79.09), 'Patna': (25.59, 85.14), 'Pune': (18.52, 73.86),
    'Surat': (21.17, 72.83), 'Thrissur': (10.53, 76.21),
    'Addis Ababa': (9.03, 38.74), 'Bogota': (4.71, -74.07), 'Jakarta': (-6.21, 106.85),
    'Mexico City': (19.43, -99.13), 'Sao Paulo': (-23.55, -46.63), 'Amsterdam': (52.37, 4.90),
    'Berlin': (52.52, 13.40), 'London': (51.51, -0.13), 'New York City': (40.71, -74.01),
    'Washington DC': (38.91, -77.04),
}
INDIA = [c for c in COORDS if COORDS[c][1] > 68 and COORDS[c][1] < 98 and COORDS[c][0] > 5]

# Map projection shared with make_basemap.js: equirectangular scaled by cos(22deg)
LON0, LON1, LAT0, LAT1 = 66.0, 99.0, 5.0, 38.0
K = 25.0
COS = math.cos(math.radians(22))
W = (LON1 - LON0) * K * COS
H = (LAT1 - LAT0) * K


def proj(lat, lon):
    return ((lon - LON0) * K * COS, (LAT1 - lat) * K)


def r(x, n=1):
    return None if x is None else round(x, n)


def num(x):
    return x if isinstance(x, (int, float)) and not (isinstance(x, float) and math.isnan(x)) else None


cities = {}
for name, cs in b0['cityStatsByCity'].items():
    p = b2.get(name, {})
    lat, lon = COORDS[name]
    rec = {
        'name': name,
        'country': 'India' if name in INDIA else 'Global',
        'lat': lat, 'lon': lon,
        'population_m': r(cs.get('population'), 2),
        'daily_pt_ridership_m': r(cs.get('dailyRidership'), 2),
        'pt_covered_pct': num(p.get('PT_Ridership', {}).get('Covered PCT')),
        'bus_fleet': num(cs.get('busFleetSize')),
        'buses_per_million': r(cs.get('busesPerMillion'), 0),
        'bus_shortfall': r(cs.get('busShortfall'), 0),
        'avg_travel_time_min': r(cs.get('avgTravelTime'), 1) or None,
        'free_flow_kmh': r(cs.get('freeFlowSpeed'), 1) or None,
        'am_peak_kmh': r(cs.get('morningPeakSpeed'), 1) or None,
        'pm_peak_kmh': r(cs.get('eveningPeakSpeed'), 1) or None,
        'vehicles_per_1000': r(cs.get('vehiclesPer1000'), 0),
        'evs_per_1000': r(cs.get('evsPer1000'), 1),
        'fatalities_per_million': r(cs.get('fatalitiesPerMillion'), 1),
        'crashes_per_million': r(cs.get('accidentsPerMillion'), 1),
        'modal_share': cs.get('modalShare', {}),
        'impacted': b0['roadAccidentImpactedByCity'].get(name),
        'speed_by_hour': list((p.get('Daily_Rhythm_Speeds') or {}).values()) or None,
        'bus_fleet_mix_pct': {k[:-4]: v for k, v in (p.get('BusFleetComposition') or {}).items() if k.endswith('_Pct')} or None,
        'pt_infra': p.get('PT_Infra'),
        'layers': next(({k: v for k, v in x.items() if k != 'city'} for x in b1 if x['city'] == name), None),
        'sources': p.get('Sources', {}),
        'provenance': SRC,
    }
    # Flag internal disagreements between the dashboard table (blob0) and the city profile (blob2)
    diffs = []
    pairs = [
        ('Bus fleet', cs.get('busFleetSize'), p.get('Bus_Fleet_Size', {}).get('Actual Fleet Size (Public Buses)')),
        ('Fatalities per million', cs.get('fatalitiesPerMillion'), p.get('Road_Crashes', {}).get('Fatalities Per Million')),
        ('Car mode share %', cs.get('modalShare', {}).get('Car'), p.get('Mode_Shares_PCT', {}).get('Shr_Car')),
        ('Bus mode share %', cs.get('modalShare', {}).get('Bus'), p.get('Mode_Shares_PCT', {}).get('Shr_Bus')),
        ('Vehicles per 1,000', cs.get('vehiclesPer1000'), p.get('Vehicle_Count', {}).get('Vehicles per 1000')),
    ]
    for label, a, b in pairs:
        if num(a) and num(b) and abs(a - b) / max(abs(a), abs(b)) > 0.05:
            diffs.append({'field': label, 'dashboard': r(a, 1), 'city_profile': r(b, 1)})
    rec['internal_discrepancies'] = diffs
    x, y = proj(lat, lon)
    rec['map_pct'] = {'left': round(100 * x / W, 2), 'top': round(100 * y / H, 2)} if name in INDIA else None
    cities[name] = rec

json.dump({'source': SRC, 'projection': {'lon': [LON0, LON1], 'lat': [LAT0, LAT1], 'k': K, 'cos_lat': 22,
                                          'width': round(W, 2), 'height': round(H, 2)},
           'cities': cities}, open(os.path.join(D, 'shift_cities.json'), 'w'), indent=1)

# Compact subset for the mockup (Indian cities only)
mock = []
for n in sorted(INDIA):
    c = cities[n]
    ms = c['modal_share']
    mock.append([n, c['map_pct']['left'], c['map_pct']['top'], c['population_m'], c['daily_pt_ridership_m'],
                 c['pt_covered_pct'], c['buses_per_million'], c['bus_fleet'], c['avg_travel_time_min'],
                 c['free_flow_kmh'], c['am_peak_kmh'], c['pm_peak_kmh'], c['vehicles_per_1000'], c['evs_per_1000'],
                 c['fatalities_per_million'], c['crashes_per_million'],
                 [ms.get(k, 0) for k in ['Walking', 'Cycling', 'Bus', 'BRTS', 'Metro/Rail', '2W', '3W', 'Car', 'Other']],
                 [round(v) for v in c['speed_by_hour']] if c['speed_by_hour'] else None,
                 c['sources'].get('Mobility'), c['sources'].get('Buses'), c['sources'].get('Crashes'),
                 [[d['field'], d['dashboard'], d['city_profile']] for d in c['internal_discrepancies']]])
json.dump(mock, open(os.path.join(D, 'mock_cities.json'), 'w'), separators=(',', ':'))
print('cities:', len(cities), 'india:', len(INDIA), 'W,H =', round(W, 1), round(H, 1))
print('mock bytes:', os.path.getsize(os.path.join(D, 'mock_cities.json')))
print('cities with discrepancies:', sum(1 for c in cities.values() if c['internal_discrepancies']))
