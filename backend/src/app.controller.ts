import { Controller, Get, SetMetadata } from '@nestjs/common';

const Public = () => SetMetadata('isPublic', true);

@Controller()
export class AppController {
  @Public()
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'EduTrack SaaS API',
      timestamp: new Date().toISOString(),
    };
  }
}
