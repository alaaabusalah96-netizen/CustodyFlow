// Arabic Tafqeet (number to words) helper function
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

// English Tafqeet (number to words) helper function
export function getEnglishTafqeet(amount: number): string {
  const parts = amount.toFixed(2).split('.');
  const pounds = parseInt(parts[0], 10);
  const piastres = parseInt(parts[1], 10);

  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  function convertBelowThousand(num: number): string {
    if (num === 0) return '';
    if (num < 20) return ones[num];
    if (num < 100) {
      const rest = num % 10;
      return tens[Math.floor(num / 10)] + (rest > 0 ? '-' + ones[rest] : '');
    }
    const h = Math.floor(num / 100);
    const rest = num % 100;
    return ones[h] + ' hundred' + (rest > 0 ? ' and ' + convertBelowThousand(rest) : '');
  }

  function formatPounds(p: number): string {
    if (p === 0) return 'zero';
    let result = '';
    
    const millions = Math.floor(p / 1000000);
    let rem = p % 1000000;
    const thousands = Math.floor(rem / 1000);
    rem = rem % 1000;

    if (millions > 0) {
      result += convertBelowThousand(millions) + ' million ';
    }
    if (thousands > 0) {
      result += convertBelowThousand(thousands) + ' thousand ';
    }
    if (rem > 0) {
      result += convertBelowThousand(rem);
    }
    return result.trim();
  }

  let poundsStr = formatPounds(pounds);
  let res = `Only ${poundsStr} Egyptian Pound${pounds !== 1 ? 's' : ''}`;
  if (piastres > 0) {
    res += ` and ${convertBelowThousand(piastres)} Piastre${piastres !== 1 ? 's' : ''}`;
  }
  return res + ' only';
}
