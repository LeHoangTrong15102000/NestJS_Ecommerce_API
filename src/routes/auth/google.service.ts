import { Injectable } from '@nestjs/common'
import { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import { GoogleAuthStateType } from 'src/routes/auth/auth.model'
import envConfig from 'src/shared/config'

@Injectable()
export class GoogleService {
  private oauth2Client: OAuth2Client
  constructor() {
    // Thì nó sẽ nhận vào clientId clientSecret và RedirectUri, truyền vào đúng thứ tự cho nó là được
    this.oauth2Client = new google.auth.OAuth2(
      envConfig.GOOGLE_CLIENT_ID,
      envConfig.GOOGLE_CLIENT_SECRET,
      envConfig.GOOGLE_REDIRECT_URI,
    )
  }

  getAuthorizationUrl({ userAgent, ip }: GoogleAuthStateType) {
    // Khai báo phạm vi truy cập vào thông tin tài khoản của người dùng
    const scope = ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email']
    // Sẽ tạo cái string từ userAgent và ip để đưa vào URL -> chuyển nó thành base64 để bảo mật, an toàn có thể bỏ lên URL
    const stateString = Buffer.from(JSON.stringify({ userAgent, ip })).toString('base64')
    const url = this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // để là offline
      scope,
      include_granted_scopes: true, // để mà trả về refreshToken
      state: stateString, // để đảm bảo user chỉ truy cập vào đây khi chúng ta đã xác nhận từ google
    })

    return {
      url,
    }
  }

  async googleCallback() {}
}
