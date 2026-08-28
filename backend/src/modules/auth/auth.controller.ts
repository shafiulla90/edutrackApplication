import { Controller, Post, Get, Body, Headers } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@Headers('authorization') authHeader?: string) {
    return this.authService.getProfile(authHeader);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new school/institution account' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login to the platform' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('send-otp')
  @ApiOperation({ summary: 'Send OTP to registered mobile number' })
  sendOtp(@Body() body: { phone: string; portal?: string }) {
    return this.authService.sendOtp(body.phone, body.portal);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP or ID token' })
  verifyOtp(@Body() body: { phone: string; otp?: string; otpCode?: string; idToken?: string; portal?: string }) {
    return this.authService.verifyOtp(body.phone, body.otp || body.otpCode, body.idToken, body.portal);
  }

  @Post('exchange-code')
  @ApiOperation({ summary: 'Exchange authorization code' })
  exchangeCode(@Body() body: { code: string }) {
    return this.authService.exchangeCode(body.code);
  }
}
