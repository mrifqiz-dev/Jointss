import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { NgForm } from '@angular/forms';
import { NavController } from '@ionic/angular';
import { firstValueFrom, timeout, TimeoutError } from 'rxjs';
import { ApiService } from '../services/api.service';

interface LoginResponse {
  status: 'success';
  data: { id_pengguna: number; nama: string };
}

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage {
  private readonly api = inject(ApiService);
  private readonly navCtrl = inject(NavController);

  readonly sedangMasuk = signal(false);
  readonly pesanError = signal('');
  readonly tampilkanSandi = signal(false);
  formLogin = { email: '', password: '' };

  ubahEmail(email: string) {
    this.formLogin.email = email.trim();
    this.pesanError.set('');
  }

  async prosesMasuk(form: NgForm) {
    if (this.sedangMasuk()) return;

    this.pesanError.set('');
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    this.sedangMasuk.set(true);
    try {
      const response: unknown = await firstValueFrom(
        this.api.login({ ...this.formLogin }).pipe(timeout(15000)),
      );

      if (!this.responsValid(response)) {
        this.pesanError.set('Respons masuk belum sesuai. Silakan coba lagi nanti.');
        return;
      }

      // Pertahankan kontrak penyimpanan dan navigasi yang sudah digunakan tim.
      // Data profil ini bukan pengganti autentikasi dan otorisasi pada server.
      try {
        localStorage.setItem('ecoapp_user', JSON.stringify(response.data));
      } catch {
        this.pesanError.set('Data masuk tidak dapat disimpan. Coba buka ulang aplikasi.');
        return;
      }

      this.formLogin.password = '';
      this.tampilkanSandi.set(false);
      const berhasilPindah = await this.navCtrl.navigateRoot('/home', {
        animated: true,
        animationDirection: 'forward',
      });
      if (!berhasilPindah) {
        this.pesanError.set('Halaman utama belum dapat dibuka. Silakan coba masuk kembali.');
      }
    } catch (error: unknown) {
      this.pesanError.set(this.pesanKegagalan(error));
    } finally {
      this.sedangMasuk.set(false);
    }
  }

  private responsValid(response: unknown): response is LoginResponse {
    if (!response || typeof response !== 'object') return false;
    const result = response as Partial<LoginResponse>;
    return result.status === 'success'
      && typeof result.data?.id_pengguna === 'number'
      && Number.isInteger(result.data.id_pengguna)
      && result.data.id_pengguna > 0
      && typeof result.data.nama === 'string';
  }

  private pesanKegagalan(error: unknown): string {
    if (error instanceof TimeoutError) {
      return 'Server terlalu lama merespons. Silakan coba lagi.';
    }
    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 0:
          return 'Tidak dapat terhubung ke layanan Pilahin. Periksa koneksi dan coba lagi.';
        case 400:
        case 422:
          return 'Periksa kembali email dan kata sandi yang kamu masukkan.';
        case 401:
          return 'Email atau kata sandi salah, atau akun tidak aktif.';
        case 403:
          return 'Akun belum dapat mengakses layanan. Hubungi pengelola Pilahin.';
        case 429:
          return 'Terlalu banyak percobaan masuk. Tunggu sebentar sebelum mencoba lagi.';
        default:
          return 'Layanan masuk sedang bermasalah. Silakan coba lagi nanti.';
      }
    }
    return 'Proses masuk belum berhasil. Silakan coba lagi.';
  }
}
