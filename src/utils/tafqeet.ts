export function getArabicTafqeet(amount: number): string {
  const parts = amount.toFixed(2).split('.');
  const pounds = parseInt(parts[0], 10);
  const piastres = parseInt(parts[1], 10);

  const units = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  function convertBelowHundred(n: number): string {
    if (n === 0) return '';
    if (n <= 10) return units[n];
    if (n < 20) return teens[n - 10];
    const u = n % 10;
    const t = Math.floor(n / 10);
    if (u > 0) {
      return units[u] + ' و' + tens[t];
    }
    return tens[t];
  }

  function convertBelowThousand(n: number): string {
    if (n === 0) return '';
    const h = Math.floor(n / 100);
    const rest = n % 100;
    let result = '';
    
    if (h > 0) {
      result += hundreds[h];
    }
    
    if (rest > 0) {
      if (h > 0) result += ' و';
      result += convertBelowHundred(rest);
    }
    return result;
  }

  function formatPounds(p: number): string {
    if (p === 0) return 'صفر';
    if (p === 1) return 'جنيه واحد';
    if (p === 2) return 'جنيهان';
    if (p >= 3 && p <= 10) return convertBelowThousand(p) + ' جنيهات';
    
    let result = '';
    const th = Math.floor(p / 1000);
    const rem = p % 1000;

    if (th > 0) {
      if (th === 1) result += 'ألف';
      else if (th === 2) result += 'ألفان';
      else if (th >= 3 && th <= 10) result += convertBelowThousand(th) + ' آلاف';
      else result += convertBelowThousand(th) + ' ألف';
    }

    if (rem > 0) {
      if (th > 0) result += ' و';
      result += convertBelowThousand(rem);
    }

    return result + ' جنيه';
  }

  let text = formatPounds(pounds);
  
  if (pounds > 10 && pounds % 100 !== 0) {
    text = text.replace(' جنيه', ' جنيهاً');
  }

  if (piastres > 0) {
    let piastreText = convertBelowHundred(piastres);
    if (piastres === 1) piastreText = 'قرش واحد';
    else if (piastres === 2) piastreText = 'قرشان';
    else if (piastres >= 3 && piastres <= 10) piastreText += ' قروش';
    else piastreText += ' قرشاً';
    text += ' و' + piastreText;
  }
  
  return 'فقط ' + text + ' لا غير';
}

export function getEnglishTafqeet(amount: number): string {
  const pounds = Math.floor(amount);
  const piastres = Math.round((amount % 1) * 100);

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertLessThanThousand(n: number): string {
    if (n === 0) return '';
    let result = '';
    const h = Math.floor(n / 100);
    const rest = n % 100;
    if (h > 0) {
      result += ones[h] + ' Hundred';
    }
    if (rest > 0) {
      if (h > 0) result += ' and ';
      if (rest < 20) {
        result += ones[rest];
      } else {
        const u = rest % 10;
        const t = Math.floor(rest / 10);
        result += tens[t];
        if (u > 0) result += '-' + ones[u];
      }
    }
    return result;
  }

  function convertPounds(p: number): string {
    if (p === 0) return 'Zero';
    let result = '';
    
    const billions = Math.floor(p / 1000000000);
    const millions = Math.floor((p % 1000000000) / 1000000);
    const thousands = Math.floor((p % 1000000) / 1000);
    const remaining = p % 1000;

    if (billions > 0) {
      result += convertLessThanThousand(billions) + ' Billion ';
    }
    if (millions > 0) {
      result += convertLessThanThousand(millions) + ' Million ';
    }
    if (thousands > 0) {
      result += convertLessThanThousand(thousands) + ' Thousand ';
    }
    if (remaining > 0) {
      result += convertLessThanThousand(remaining);
    }
    return result.trim();
  }

  let text = convertPounds(pounds) + ' Egyptian Pounds';
  
  if (piastres > 0) {
    let piastreText = '';
    if (piastres < 20) {
      piastreText = ones[piastres];
    } else {
      const u = piastres % 10;
      const t = Math.floor(piastres / 10);
      piastreText = tens[t];
      if (u > 0) piastreText += '-' + ones[u];
    }
    text += ' and ' + piastreText + ' Piastres';
  } else {
    text += ' Only';
  }

  return 'Only ' + text;
}
