// The Port of Split, built from open data by tools/chart/build_region.py (region tools/chart/regions/split.json):
// land, piers, the numbered ferry berths, quay bollards, lights and marks from OpenStreetMap / OpenSeaMap (ODbL),
// depths offshore from EMODnet (CC BY 4.0) and in the harbour from the port's published figures (10.5 m at the
// cruise berths outside the breakwater, 7 to 10 m inside). No free official chart exists for Croatia: depths are
// approximate. Simulation only, not for navigation.

const area = { shoals: [], obstacles: [], fenders: [], bollards: [], landHeight: 2.5, chart: 'split', area: 'split', tide: 0, needsData: true, depth: 30, tugBP: 50 * 9.81e3 };

export const SPLIT_FERRY = {
  ...area,
  id: 'split-ferry', name: 'Split · Ro-Pax ferry to Gat sv. Duje',
  brief: 'Open data chart (OpenStreetMap, EMODnet). Bring a 200 m car and passenger ferry in from the Split channel, round the breakwater head and lay her starboard side to at Berth 19 on Gat sv. Duje, among the island ferries. A fresh bura (north-easterly) blows off the land.',
  ship: 'ropax',
  start: { n: -950, e: -650, psi: 25, kn: 6 },
  windKn: 18, windFrom: 40, gusts: true, currentKn: 0.2, currentSet: 300,
  mooringSide: 1 as const, tugSide: -1 as const, zoom: 0.25,
  berthRef: { match: /Berth 19$/, side: 1 as const },
};
export const SPLIT_CRUISE = {
  ...area,
  id: 'split-cruise', name: 'Split · cruise ship to the breakwater',
  brief: 'Open data chart (OpenStreetMap, EMODnet). The 293 m Spirit to the outer cruise berth along the breakwater, 10.5 m alongside, ships to 320 m. Come up the channel from the south and lay her port side to; the jugo (south-easterly) sets her onto the wall.',
  ship: 'spirit',
  start: { n: -1050, e: -900, psi: 50, kn: 5 },
  windKn: 15, windFrom: 135, gusts: true, currentKn: 0.3, currentSet: 300,
  mooringSide: -1 as const, tugSide: 1 as const, zoom: 0.22,
  berthRef: { match: /Breakwater · Berth 26$/, side: -1 as const },
};
export const SPLIT_FAST = {
  ...area,
  id: 'split-fast', name: 'Split · catamaran into the city port',
  brief: 'Open data chart (OpenStreetMap, EMODnet). A 70 m fast catamaran from the islands, in past the breakwater head and up the crowded basin to Berth 11. Take the speed off before the entrance: the berths are close together and the basin is short.',
  ship: 'hsc-cat',
  start: { n: -1000, e: -750, psi: 25, kn: 12 },
  windKn: 10, windFrom: 300, gusts: true, currentKn: 0.2, currentSet: 300,
  mooringSide: -1 as const, zoom: 0.25,
  berthRef: { match: /^Berth 11$/, side: -1 as const },
};
export const SPLIT_MEDMOOR = {
  ...area,
  id: 'split-medmoor', name: 'Split · Mediterranean moor, stern-to',
  brief: 'Open data chart (OpenStreetMap, EMODnet). A 90 m superyacht stern-to on the north quay of the city port, Mediterranean style. Lie off with the bow out, let go both bow anchors about two to three ship lengths off the quay, go astern paying out chain, check her on the brakes a few metres off and run the stern lines to the bollards.',
  ship: 'superyacht',
  start: { n: 255, e: -50, psi: 180, kn: 0 },
  windKn: 8, windFrom: 90, gusts: true, currentKn: 0, currentSet: 0,
  mooringSide: 1 as const, zoom: 1.2,
};
export const SPLIT_SCENARIOS = [SPLIT_FERRY, SPLIT_CRUISE, SPLIT_FAST, SPLIT_MEDMOOR];
