// Payload точечных ручек мероприятий: POST/PUT /casino/:id/events[/:eventId].
// active сюда не входит — его считает сервер из start (см. CasinoService и
// крон TasksService.updateCasinoEventsActiveState).
export class CasinoEventDto {
  readonly name: Record<string, string> | string;
  readonly description: Record<string, string> | string;
  readonly start: Date | string;
  readonly end: Date | string;
}

export class UpdateCasinoEventDto {
  readonly name?: Record<string, string> | string;
  readonly description?: Record<string, string> | string;
  readonly start?: Date | string;
  readonly end?: Date | string;
}
