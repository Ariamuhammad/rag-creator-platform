import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Override handleRequest so that if no user / invalid token, it does NOT throw 401
  handleRequest(err: any, user: any) {
    return user || null;
  }
}
