/**
 * Turn a printed paper on screen into an A4 PDF file.
 *
 * The page is photographed (html2canvas) rather than re-typeset, so Bangla
 * text comes out exactly as the browser draws it. Both libraries are loaded
 * only when a PDF is actually made, to keep them out of the main bundle.
 */
export async function elementToPdf(element, filename) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const shoot = (skipImages) => html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    windowWidth: 1000,
    // A phone screen squeezes the paper; lay the copy out at desk width.
    onclone: (doc) => {
      const copy = doc.querySelector('[data-pdf-root]');
      if (copy) copy.style.width = '800px';
    },
    ignoreElements: (el) => el.classList?.contains('no-print') || (skipImages && el.tagName === 'IMG'),
  });

  let canvas = await shoot(false);
  let image;
  try {
    image = canvas.toDataURL('image/jpeg', 0.92);
  } catch {
    // A logo from another site without CORS taints the canvas — drop images and retry.
    canvas = await shoot(true);
    image = canvas.toDataURL('image/jpeg', 0.92);
  }

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const imgW = pageW - margin * 2;
  const imgH = (canvas.height * imgW) / canvas.width;
  const usable = pageH - margin * 2;

  // Long papers run onto more pages: the same image, shifted up one page each time.
  for (let offset = 0, page = 0; offset < imgH; offset += usable, page += 1) {
    if (page > 0) pdf.addPage();
    pdf.addImage(image, 'JPEG', margin, margin - offset, imgW, imgH);
    // Mask the spill above/below the margins so pages read cleanly.
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageW, margin, 'F');
    pdf.rect(0, pageH - margin, pageW, margin, 'F');
  }

  const blob = pdf.output('blob');
  return new File([blob], filename, { type: 'application/pdf' });
}

/** Save a File to the device's downloads. */
export function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
