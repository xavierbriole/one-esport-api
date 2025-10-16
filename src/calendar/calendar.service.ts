import { Injectable, Logger } from '@nestjs/common';
import ical from 'ical-generator';
import { DateTime } from 'luxon';

interface PandaMatch {
  id: number;
  name: string;
  status: 'canceled' | 'finished' | 'not_started' | 'postponed' | 'running';
  scheduled_at: string | null;
  number_of_games: number;
  opponents: { opponent: { acronym: string } }[];
  results: { score: number; team_id: number }[];
  tournament: { name: string };
}

interface PandaLeague {
  id: number;
  name: string;
  videogame: { name: string };
}

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private cachedCalendar: Map<number, string> = new Map();
  private lastUpdate: Map<number, number> = new Map();
  private readonly API_BASE = 'https://api.pandascore.co/leagues';
  private readonly TOKEN = process.env.PANDASCORE_TOKEN;
  private readonly CACHE_DURATION_IN_MIN = 5;

  private async fetchMatches(leagueId: number): Promise<PandaMatch[]> {
    const endpoints = ['running', 'past', 'upcoming'];
    const allMatches: PandaMatch[] = [];

    for (const endpoint of endpoints) {
      const res = await fetch(
        `${this.API_BASE}/${leagueId}/matches/${endpoint}`,
        {
          headers: { Authorization: `Bearer ${this.TOKEN}` },
        },
      );
      if (!res.ok) throw new Error(`Erreur API ${endpoint}: ${res.status}`);
      const data = (await res.json()) as PandaMatch[];
      allMatches.push(...data);
    }

    return allMatches;
  }

  private async fetchLeague(id: number): Promise<PandaLeague> {
    const res = await fetch(`https://api.pandascore.co/leagues/${id}`, {
      headers: { Authorization: `Bearer ${this.TOKEN}` },
    });
    if (!res.ok) throw new Error(`Erreur API League: ${res.status}`);
    return (await res.json()) as PandaLeague;
  }

  public async getCalendar(leagueId: number): Promise<string> {
    const now = Date.now();
    const lastUpdateTime = this.lastUpdate.get(leagueId) || 0;
    const needsRefresh =
      !this.cachedCalendar.has(leagueId) ||
      now - lastUpdateTime > this.CACHE_DURATION_IN_MIN * 60 * 1000;

    this.logger.log(
      `${needsRefresh ? '🔄 Rafraîchissement' : '📦 Cache'} du calendrier pour la league ${leagueId}`,
    );

    if (needsRefresh) {
      const matches = await this.fetchMatches(leagueId);
      const league = await this.fetchLeague(leagueId);

      const cal = ical({
        name: `${league.name} ${league.videogame.name}`,
        timezone: 'UTC',
      });

      for (const match of matches) {
        if (!match.scheduled_at) continue;

        const start = DateTime.fromISO(match.scheduled_at, { zone: 'utc' });
        const end = start.plus({ hours: match.number_of_games });

        const teams = match.opponents
          .map((o) => o.opponent.acronym)
          .join(' vs ');

        let title: string;

        if (match.status === 'finished' && match.results.length >= 2) {
          const score1 = match.results[0].score;
          const score2 = match.results[1].score;
          const team1 = match.opponents[0].opponent.acronym;
          const team2 = match.opponents[1].opponent.acronym;

          title = `${team1} ${score1} - ${score2} ${team2}`;
        } else {
          title = teams || match.name;
        }

        cal.createEvent({
          start: start.toJSDate(),
          end: end.toJSDate(),
          summary: title,
          description: `${match.tournament.name} - ${match.status}`,
          uid: `match-${match.id}@pandascore` as any,
          timezone: 'UTC',
        });
      }

      this.cachedCalendar.set(leagueId, cal.toString());
      this.lastUpdate.set(leagueId, now);
    }

    return this.cachedCalendar.get(leagueId)!;
  }
}
