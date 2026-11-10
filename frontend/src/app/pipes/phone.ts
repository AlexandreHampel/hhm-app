import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'phone',
  standalone: true
})
export class PhonePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    const phone = (value ?? '').trim();
    const digits = phone.replace(/\D/g, '');

    if (/^55\d{10,11}$/.test(digits) && (phone.startsWith('+') || digits.length > 11)) {
      return this.formatNational(digits.slice(2)) ? `+55 ${this.formatNational(digits.slice(2))}` : phone;
    }

    if (phone.startsWith('+')) {
      return phone;
    }

    return this.formatNational(digits) || phone;
  }

  private formatNational(digits: string): string {
    switch (digits.length) {
      case 11:
        return digits[2] === '9' ? digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3') : '';
      case 10:
        return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
      case 9:
        return digits.replace(/^(\d{5})(\d{4})$/, '$1-$2');
      case 8:
        return digits.replace(/^(\d{4})(\d{4})$/, '$1-$2');
      default:
        return '';
    }
  }
}
