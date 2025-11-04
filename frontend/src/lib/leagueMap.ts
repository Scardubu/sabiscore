export interface LeagueOption {
  value: string
  label: string
}

export const LEAGUE_OPTIONS: LeagueOption[] = [
  { value: 'EPL', label: 'Premier League' },
  { value: 'La Liga', label: 'La Liga' },
  { value: 'Bundesliga', label: 'Bundesliga' },
  { value: 'Serie A', label: 'Serie A' },
  { value: 'Ligue 1', label: 'Ligue 1' },
  { value: 'Champions League', label: 'Champions League' },
  { value: 'Europa League', label: 'Europa League' },
]

const TEAM_LEAGUE_MAP: Record<string, string> = {
  // Premier League
  arsenal: 'EPL', arsenalfc: 'EPL',
  astonvilla: 'EPL', astonvillafc: 'EPL',
  bournemouth: 'EPL', afcbournemouth: 'EPL', bournemouthfc: 'EPL',
  brentford: 'EPL', brentfordfc: 'EPL',
  brighton: 'EPL', brightonandhovealbion: 'EPL', brightonandhovealbionfc: 'EPL',
  burnley: 'EPL', burnleyfc: 'EPL',
  chelsea: 'EPL', chelseafc: 'EPL',
  crystalpalace: 'EPL', crystalpalacefc: 'EPL',
  everton: 'EPL', evertonfc: 'EPL',
  fulham: 'EPL', fulhamfc: 'EPL',
  liverpool: 'EPL', liverpoolfc: 'EPL',
  lutontown: 'EPL', lutontownfc: 'EPL',
  manchestercity: 'EPL', manchestercityfc: 'EPL', mcf: 'EPL',
  manchesterunited: 'EPL', manchesterunitedfc: 'EPL', mufc: 'EPL',
  newcastleunited: 'EPL', newcastleunitedfc: 'EPL',
  nottinghamforest: 'EPL', nottinghamforestfc: 'EPL',
  sheffieldunited: 'EPL', sheffieldunitedfc: 'EPL',
  tottenhamhotspur: 'EPL', tottenhamhotspurfc: 'EPL', spurs: 'EPL',
  westhamunited: 'EPL', westhamunitedfc: 'EPL',
  wolverhamptonwanderers: 'EPL', wolverhamptonwanderersfc: 'EPL', wolves: 'EPL',

  // La Liga
  realmadrid: 'La Liga', realmadridcf: 'La Liga',
  barcelona: 'La Liga', fcb: 'La Liga', barcelonafc: 'La Liga',
  atletico: 'La Liga', atleticodemadrid: 'La Liga', atleticomadrid: 'La Liga',
  realbetis: 'La Liga', realbetisbalompie: 'La Liga',
  realsociedad: 'La Liga',
  villarreal: 'La Liga', villarrealcf: 'La Liga',
  valencia: 'La Liga', valenciacf: 'La Liga',
  athleticbilbao: 'La Liga', athleticclub: 'La Liga',
  girona: 'La Liga', gironafc: 'La Liga',
  getafe: 'La Liga', getafecf: 'La Liga',
  osasuna: 'La Liga',
  rayovallecano: 'La Liga',
  mallorca: 'La Liga', rcdmallorca: 'La Liga',
  cadiz: 'La Liga', cadizcf: 'La Liga',
  celtavigo: 'La Liga', realclubcelta: 'La Liga',
  granada: 'La Liga', granadacf: 'La Liga',
  alaves: 'La Liga', deportivoalaves: 'La Liga',
  laspalmas: 'La Liga', udlaspalmas: 'La Liga',
  almeria: 'La Liga', udealmeria: 'La Liga',

  // Bundesliga
  bayernmunich: 'Bundesliga', bayernmunchen: 'Bundesliga', fcbayern: 'Bundesliga',
  borussiadortmund: 'Bundesliga', bvb: 'Bundesliga',
  rbleipzig: 'Bundesliga', leipzig: 'Bundesliga',
  bayerleverkusen: 'Bundesliga', leverkusen: 'Bundesliga',
  borussiamgladbach: 'Bundesliga', borussiamonchengladbach: 'Bundesliga',
  eintrachtfrankfurt: 'Bundesliga', frankfurt: 'Bundesliga',
  freiburg: 'Bundesliga', scfreiburg: 'Bundesliga',
  unionberlin: 'Bundesliga', fcunionberlin: 'Bundesliga',
  wolfsburg: 'Bundesliga', vflwolfsburg: 'Bundesliga',
  mainz: 'Bundesliga', mainz05: 'Bundesliga',
  hoffenheim: 'Bundesliga', tsg1899hoffenheim: 'Bundesliga',
  augsburg: 'Bundesliga', fca: 'Bundesliga',
  vfbstuttgart: 'Bundesliga', stuttgart: 'Bundesliga',
  bochum: 'Bundesliga', vflbochum: 'Bundesliga',
  herthabsc: 'Bundesliga', hertha: 'Bundesliga',
  schalke04: 'Bundesliga', schalke: 'Bundesliga',
  werderbremen: 'Bundesliga', bremen: 'Bundesliga',
  darmstadt98: 'Bundesliga', darmstadt: 'Bundesliga',
  heidenheim: 'Bundesliga',

  // Serie A
  acmilan: 'Serie A', milan: 'Serie A',
  intermilan: 'Serie A', inter: 'Serie A', internazionale: 'Serie A',
  juventus: 'Serie A', juventusfc: 'Serie A',
  napoli: 'Serie A', sscnapoli: 'Serie A',
  lazio: 'Serie A', sslazio: 'Serie A',
  asroma: 'Serie A', roma: 'Serie A',
  atalanta: 'Serie A', atalantabc: 'Serie A',
  fiorentina: 'Serie A', acfiorentina: 'Serie A',
  torino: 'Serie A', torinofc: 'Serie A',
  bologna: 'Serie A', bolognafc: 'Serie A',
  udinese: 'Serie A', udinesecalcio: 'Serie A',
  sassuolo: 'Serie A', sassuolocalcio: 'Serie A',
  genoa: 'Serie A', genoacfc: 'Serie A',
  monza: 'Serie A',
  lecce: 'Serie A', uslecce: 'Serie A',
  salernitana: 'Serie A', ussalernitana: 'Serie A',
  cagliari: 'Serie A', cagliaricalcio: 'Serie A',
  empoli: 'Serie A', empolifc: 'Serie A',
  verona: 'Serie A', hellasverona: 'Serie A',

  // Ligue 1
  parispsg: 'Ligue 1', parisstgermain: 'Ligue 1', psg: 'Ligue 1',
  marseille: 'Ligue 1', olympiquedemarseille: 'Ligue 1', om: 'Ligue 1',
  lyon: 'Ligue 1', olympiquelyonnais: 'Ligue 1',
  monaco: 'Ligue 1', asmonaco: 'Ligue 1',
  lille: 'Ligue 1', losc: 'Ligue 1',
  nice: 'Ligue 1', ogcnice: 'Ligue 1',
  rennes: 'Ligue 1', staderennais: 'Ligue 1',
  reims: 'Ligue 1', stadedereims: 'Ligue 1',
  nantes: 'Ligue 1', fcnantes: 'Ligue 1',
  lorient: 'Ligue 1', fclorient: 'Ligue 1',
  toulouse: 'Ligue 1', toulousefc: 'Ligue 1',
  montpellier: 'Ligue 1', montpellierhsc: 'Ligue 1',
  brest: 'Ligue 1', stadebrestois: 'Ligue 1',
  metz: 'Ligue 1', fcmetz: 'Ligue 1',
  strasbourg: 'Ligue 1', rcstrasbourg: 'Ligue 1',
  clermont: 'Ligue 1', clermontfoot: 'Ligue 1',
  ajaccio: 'Ligue 1', acajaccio: 'Ligue 1',
  angers: 'Ligue 1', scoangers: 'Ligue 1',
  auxerre: 'Ligue 1', aja: 'Ligue 1',
  troyes: 'Ligue 1', estac: 'Ligue 1',
}

const normalizeTeamName = (name: string | undefined) =>
  name?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? ''

export const inferLeagueFromTeams = (
  homeTeam?: string,
  awayTeam?: string,
): string | null => {
  const normalizedHome = normalizeTeamName(homeTeam)
  const normalizedAway = normalizeTeamName(awayTeam)

  if (!normalizedHome && !normalizedAway) {
    return null
  }

  const homeLeague = TEAM_LEAGUE_MAP[normalizedHome]
  const awayLeague = TEAM_LEAGUE_MAP[normalizedAway]

  if (homeLeague && awayLeague) {
    if (homeLeague === awayLeague) {
      return homeLeague
    }
    return 'Champions League'
  }

  return homeLeague ?? awayLeague ?? null
}

export const getLeagueLabel = (value: string): string =>
  LEAGUE_OPTIONS.find((league) => league.value === value)?.label ?? value
