import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import type { Response } from 'express';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get(':leagueId')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  async getCalendar(@Param('leagueId') leagueId: string, @Res() res: Response) {
    res.setHeader('Content-Disposition', `inline; filename=${leagueId}.ics`);
    const calendar = await this.calendarService.getCalendar(
      parseInt(leagueId, 10),
    );
    res.send(calendar);
  }
}
