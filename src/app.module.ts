import { Module } from '@nestjs/common';
import { CalendarModule } from './calendar/calendar.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot(), CalendarModule],
})
export class AppModule {}
