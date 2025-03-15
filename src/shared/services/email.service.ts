import { Injectable } from '@nestjs/common'
import { Resend } from 'resend'
import envConfig from 'src/shared/config'

@Injectable()
export class EmailService {
  private resend: Resend
  constructor() {
    // Khai báo apiKey cho resend
    this.resend = new Resend(envConfig.RESEND_API_KEY)
  }

  async sendOTP(payload: { email: string; code: string }) {
    // Do đang ở môi trường sandbox nên chỉ có thể đăng kí tài khoản được ở cái email đã đăng kí rồi mà thôi
    // Muốn gửi được tới các thằng khác thì cần phải verify domain của chúng ta thì mới gửi được
    // Muốn mà lấy được cái data và error khi mà gửi đi thì ở bên đây cần phải return về cái object mail như này
    return this.resend.emails.send({
      from: 'Ecommerce Agents <onboarding@resend.dev>',
      to: [payload.email],
      subject: 'Mã OTP dùng để xác thực',
      html: `<strong>${payload.code}</strong>`,
    })
  }
}
